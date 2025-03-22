"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const generative_ai_1 = require("@google/generative-ai");
const marked = __importStar(require("marked"));
function activate(context) {
    // Command untuk chat biasa
    const chatCommand = vscode.commands.registerCommand('extension.inlineChat', openChat);
    // Command untuk kirim kode ke AI
    const sendCodeCommand = vscode.commands.registerCommand('extension.sendCodeToAI', sendCodeToAI);
    context.subscriptions.push(chatCommand, sendCodeCommand);
}
// ✅ Fungsi untuk membuka chat
function openChat() {
    const panel = vscode.window.createWebviewPanel('inlineChat', 'Inline Chat Assistant', vscode.ViewColumn.Beside, { enableScripts: true });
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
    }
    catch (error) {
        const errorMessage = error?.message || 'An unknown error occurred';
        console.error('AI Error:', errorMessage);
        return `Error: ${errorMessage}`;
    }
}
// ✅ Fungsi untuk mendapatkan respon AI
async function getAIResponse(prompt) {
    const apiKey = getApiKey();
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('AI Error:', error.message);
            vscode.window.showErrorMessage(`AI Error: ${error.message}`);
        }
        else {
            console.error('Unexpected Error:', error);
            vscode.window.showErrorMessage('Unexpected Error occurred.');
        }
        return 'Failed to get AI response.';
    }
}
// ✅ Fungsi untuk menampilkan respons di panel baru
function showResponseInPanel(response) {
    const panel = vscode.window.createWebviewPanel('aiResponse', 'AI Response', vscode.ViewColumn.Beside, { enableScripts: true });
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
function getApiKey() {
    const config = vscode.workspace.getConfiguration('inlineChat');
    const apiKey = config.get('apiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('API Key not set. Please configure it in Settings.');
        throw new Error('API Key missing.');
    }
    return apiKey;
}
// ✅ Ambil System Instruction dari Pengaturan
function getSystemInstruction() {
    const config = vscode.workspace.getConfiguration('inlineChat');
    const instruction = config.get('systemInstruction');
    return instruction || 'You are a helpful assistant.';
}
// ✅ HTML untuk Chat
function getWebviewContent() {
    return `
  <!DOCTYPE html>
  <html>
  <body>
    <h3>Inline Chat Assistant</h3>
    <textarea id="chatInput" rows="4" cols="50" placeholder="Type your message..."></textarea>
    <button onclick="sendMessage()">Send</button>
    <p id="response">Waiting for response...</p>

    <script>
      const vscode = acquireVsCodeApi();
      function sendMessage() {
        const input = document.getElementById('chatInput').value;
        vscode.postMessage({ text: input });
      }
      window.addEventListener('message', event => {
        document.getElementById('response').innerText = event.data.reply;
      });
    </script>
  </body>
  </html>
  `;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map