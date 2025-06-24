from app.config import TELEGRAM_BOT_TOKEN
import requests

def send_telegram_message(chat_id: str, message: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "MarkdownV2"
    }
    try:
        response = requests.post(url, data=data)
        if response.status_code != 200:
            print(f"Telegram API Error: {response.status_code} - {response.text}")
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Failed to send message to {chat_id}: {e}")