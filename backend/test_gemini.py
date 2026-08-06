import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")

print(f"Testing Gemini API Key: {api_key[:10]}...")

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say 'API Key is working' if you receive this."
    )
    print("SUCCESS!")
    print("Response:", response.text)
except Exception as e:
    print("FAILED!")
    print(str(e))
