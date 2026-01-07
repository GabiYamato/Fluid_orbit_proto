#!/bin/bash

echo "🚀 Setting up Local Llama (Meta) Model via Ollama..."

# 1. Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            echo "🍺 Using Homebrew to install Ollama..."
            brew install ollama
        else
            echo "❌ Homebrew not found. Please download Ollama from https://ollama.com/download/mac"
            exit 1
        fi
    else
        # Linux
        curl -fsSL https://ollama.com/install.sh | sh
    fi
else
    echo "✅ Ollama is already installed."
fi

# 2. Start Ollama in background (unless running)
if ! pgrep -x "ollama" > /dev/null; then
    echo "🔄 Starting Ollama server..."
    # On mac, brew services might be better, but 'ollama serve' works
    ollama serve &
    OLLAMA_PID=$!
    echo "⏳ Waiting 10s for Ollama to initialize..."
    sleep 10
else
    echo "✅ Ollama server is running."
fi

# 3. Pull models
# llama3.2:3b is faster. nomic-embed-text for embeddings.
MODEL_NAME="llama3.2:3b"
EMBEDDING_MODEL="nomic-embed-text"

echo "⬇️  Pulling $MODEL_NAME..."
ollama pull $MODEL_NAME
echo "⬇️  Pulling $EMBEDDING_MODEL..."
ollama pull $EMBEDDING_MODEL

echo "✨ Model ready!"
echo "🧪 Running a test prompt..."

ollama run $MODEL_NAME "Hello! Explain what RAG is in one sentence."

echo ""
echo "🎉 Setup Complete!"
echo "To use this in ShopGPT:"
echo "1. We will update RAGService to point to localhost:11434"
