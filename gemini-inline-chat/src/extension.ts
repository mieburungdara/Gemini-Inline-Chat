import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as marked from 'marked';


export function activate(context: vscode.ExtensionContext) {
  // Command untuk chat biasa
  const chatCommand = vscode.commands.registerCommand('extension.inlineChat', openChat);
  
  // Command untuk kirim kode ke AI
  const sendCodeCommand = vscode.commands.registerCommand('extension.sendCodeToAI', sendCodeToAI);

  context.subscriptions.push(chatCommand, sendCodeCommand);
}

// ✅ Fungsi untuk membuka chat
function openChat() {
  const panel = vscode.window.createWebviewPanel(
    'inlineChat',
    'Inline Chat Assistant',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent();
  panel.webview.onDidReceiveMessage(async (message) => {
    const aiResponse = await getAIResponse(message.text);
    panel.webview.postMessage({ reply: aiResponse });
  });
}

// ✅ Fungsi untuk mengirim kode yang disorot ke AI
async function sendCodeToAI() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found!');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showErrorMessage('No code selected!');
    return;
  }

  // Minta input tambahan dari pengguna
  const userInput = await vscode.window.showInputBox({
    prompt: 'Tambahkan pertanyaan atau perintah untuk AI (misal: "Jelaskan kode ini")'
  });

  if (!userInput) {
    vscode.window.showErrorMessage('Input dibatalkan.');
    return;
  }

  vscode.window.showInformationMessage('Mengirim kode ke AI, mohon tunggu...');

  // Menggabungkan kode dan input pengguna
  const prompt = `Berikut adalah kode:\n\n${selectedText}\n\nInstruksi pengguna: ${userInput}`;

  try {
    const aiResponse = await getAIResponse(prompt);
    vscode.window.showInformationMessage('AI Response Received!');
    showResponseInPanel(aiResponse);
  } catch (error) {
    const errorMessage = (error as any)?.message || 'An unknown error occurred';
    console.error('AI Error:', errorMessage);
    return `Error: ${errorMessage}`;
  }  
}

// ✅ Fungsi untuk mendapatkan respon AI
async function getAIResponse(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp-01-21' });

  const systemInstruction = getSystemInstruction();

  try {
    const result = await model.generateContent({
      contents: [
        // Gabungkan system instruction sebagai bagian dari user prompt
        { role: "user", parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }
      ]
    });
  
    const responseText = await result.response.text();
    return responseText;
  } catch (error) {
    if (error instanceof Error) {
      console.error('AI Error:', error.message);
      vscode.window.showErrorMessage(`AI Error: ${error.message}`);
    } else {
      console.error('Unexpected Error:', error);
      vscode.window.showErrorMessage('Unexpected Error occurred.');
    }
    return 'Failed to get AI response.';
  }
   
  
}

// ✅ Fungsi untuk menampilkan respons di panel baru
function showResponseInPanel(response: string) {
  const panel = vscode.window.createWebviewPanel(
    'aiResponse',
    'AI Response',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  // Konversi markdown ke HTML menggunakan marked.js
  const markdownHTML = marked.parse(response);

  panel.webview.html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>AI Response</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
      }
      pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 8px;
      }
      code {
        color: #d63384;
      }
    </style>
  </head>
  <body>
    <h3>AI Response</h3>
    <div>${markdownHTML}</div>
  </body>
  </html>
  `;
}

// ✅ Ambil API Key dari Pengaturan
function getApiKey(): string {
  const config = vscode.workspace.getConfiguration('inlineChat');
  const apiKey = config.get<string>('apiKey');

  if (!apiKey) {
    vscode.window.showErrorMessage('API Key not set. Please configure it in Settings.');
    throw new Error('API Key missing.');
  }

  return apiKey;
}

// ✅ Ambil System Instruction dari Pengaturan
function getSystemInstruction(): string {
  const config = vscode.workspace.getConfiguration('inlineChat');
  const instruction = config.get<string>('systemInstruction');
  return instruction || 'You are a helpful assistant.';
}

// ✅ HTML untuk Chat
function getWebviewContent(): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Inline Chat Assistant</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
        background-color: #f9f9f9;
        color: #333;
      }
      h3 {
        color: #007acc;
      }
      textarea {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #ccc;
        resize: none;
        font-size: 14px;
      }
      button {
        margin-top: 10px;
        padding: 12px 24px;
        background-color: #007acc;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      button:hover {
        background-color: #005fa3;
      }
      #response {
        margin-top: 20px;
        padding: 15px;
        background-color: #fff;
        border-radius: 8px;
        border: 1px solid #ccc;
        min-height: 100px;
        overflow-y: auto;
      }
      .loading {
        margin-top: 20px;
        font-size: 14px;
        color: #007acc;
      }
      pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 8px;
        overflow-x: auto;
      }
      code {
        color: #d63384;
      }
      .error {
        color: red;
      }
    </style>
  </head>
  <body>
    <h3>💬 Inline Chat Assistant</h3>
    <textarea id="chatInput" rows="4" placeholder="Type your message here..."></textarea>
    <button onclick="sendMessage()">Send</button>
    <div class="loading" id="loading" style="display:none;">⏳ Generating response, please wait...</div>
    <div id="response">⚡ Your response will appear here.</div>

    <script>
      const vscode = acquireVsCodeApi();

      function sendMessage() {
        const input = document.getElementById('chatInput').value.trim();
        if (!input) {
          showError('Please enter a message before sending.');
          return;
        }

        // Reset UI and show loading
        document.getElementById('loading').style.display = 'block';
        document.getElementById('response').innerHTML = '⏳ Waiting for response...';
        
        vscode.postMessage({ text: input });
      }

      function showError(message) {
        const responseDiv = document.getElementById('response');
        responseDiv.innerHTML = '<p class="error">❗ ' + message + '</p>';
        document.getElementById('loading').style.display = 'none';
      }

      window.addEventListener('message', event => {
        const message = event.data;
        document.getElementById('loading').style.display = 'none';

        if (message.error) {
          showError(message.error);
        } else {
          const markdownHTML = marked.parse(message.reply);
          document.getElementById('response').innerHTML = markdownHTML;
          document.getElementById('response').scrollTop = document.getElementById('response').scrollHeight;
        }
      });
    </script>
  </body>
  </html>
  `;
}


export function deactivate() {}
