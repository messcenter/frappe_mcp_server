# Frappe MCP Server Setup Rehberi

## 🔧 Gerekli Bilgiler

MCP server'ın modül listesi ve diğer Frappe verilerine erişebilmesi için şu environment variable'ları set etmeniz gerekiyor:

## 📝 Environment Variables

```bash
# .env dosyası oluşturun
export FRAPPE_URL="http://your-frappe-site.com"
export FRAPPE_API_KEY="your_api_key"
export FRAPPE_API_SECRET="your_api_secret"
export FRAPPE_TEAM_NAME="your_team_name"
```

## 🔑 Frappe API Key Alma

1. Frappe Admin Panel'e girin
2. **API Management** > **API Keys** menüsüne gidin
3. **New API Key** butonuna tıklayın
4. Key ve Secret'ı kopyalayın

## 🚀 Server'ı Yeniden Başlatma

Environment variable'ları set ettikten sonra:

```bash
# Environment variable'ları set edin
export FRAPPE_URL="http://localhost:8000"
export FRAPPE_API_KEY="your_key_here"
export FRAPPE_API_SECRET="your_secret_here"

# Server'ı yeniden başlatın
pkill -f streamable-http-server
node build/streamable-http-server.js &
```

## ✅ Test

```bash
# Modül listesi test edin
curl -X POST http://127.0.0.1:51953/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_module_list","arguments":{"random_string":"test"}},"id":1}'
```

## 🔍 Cursor Konfigürasyonu

Cursor'da MCP settings:

```json
{
  "FrappMCP": {
    "url": "http://127.0.0.1:51953/"
  }
}
```

## 🛠️ Sorun Giderme

Hâlâ boş sonuç geliyorsa:

1. Frappe site'ınızın çalıştığını kontrol edin
2. API key'lerin doğru olduğunu kontrol edin
3. Network bağlantısını test edin
4. Server loglarını kontrol edin

```bash
# Server loglarını görmek için
node build/streamable-http-server.js
```