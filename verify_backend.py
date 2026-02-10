import asyncio
import httpx
from datetime import datetime
import json

BASE_URL = "http://localhost:8000"

async def main():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Register User 1
        username1 = f"user_{int(datetime.now().timestamp())}"
        print(f"Registering {username1}...")
        reg_res = await client.post("/auth/register", json={"username": username1, "public_key": "key1"})
        if reg_res.status_code != 200:
            print(f"Registration failed: {reg_res.text}")
            return
        
        secret1 = reg_res.json()["secret"]
        
        # Confirm registration (mocking TOTP is hard without current code, 
        # but wait - the backend requires correct TOTP.
        # I need to generate a valid TOTP.
        import pyotp
        totp1 = pyotp.TOTP(secret1)
        code1 = totp1.now()
        
        confirm_res = await client.post("/auth/confirm-registration", json={
            "username": username1,
            "public_key": "key1",
            "totp_secret": secret1,
            "totp_code": code1
        })
        if confirm_res.status_code != 200:
             print(f"Confirmation failed: {confirm_res.text}")
             return
        
        token1 = confirm_res.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}
        
        # 2. Register User 2
        username2 = f"user2_{int(datetime.now().timestamp())}"
        print(f"Registering {username2}...")
        reg_res2 = await client.post("/auth/register", json={"username": username2, "public_key": "key2"})
        secret2 = reg_res2.json()["secret"]
        totp2 = pyotp.TOTP(secret2)
        code2 = totp2.now()
        confirm_res2 = await client.post("/auth/confirm-registration", json={
            "username": username2,
            "public_key": "key2",
            "totp_secret": secret2,
            "totp_code": code2
        })
        token2 = confirm_res2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        # 3. Create Chat
        print("Creating chat...")
        chat_res = await client.post("/chats", json={"participant_username": username2}, headers=headers1)
        if chat_res.status_code != 200:
            print(f"Chat creation failed: {chat_res.text}")
            return
        chat_id = chat_res.json()["id"]
        print(f"Chat created: {chat_id}")

        # 4. Send Message
        print("Sending message...")
        msg_res = await client.post(f"/chats/{chat_id}/messages", json={"content": "Hello World", "type": "TEXT"}, headers=headers1)
        msg_data = msg_res.json()
        print(f"Message sent: {msg_data['id']} at {msg_data['created_at']}")
        
        # Check Timezone in message response
        created_at = msg_data['created_at']
        if "Z" in created_at or "+" in created_at:
             print("SUCCESS: Message created_at has timezone info.")
        else:
             print("FAILURE: Message created_at is naive.")

        # 5. Fetch Chats and check last_message
        print("Fetching chats...")
        chats_res = await client.get("/chats", headers=headers1)
        chats = chats_res.json()
        
        found = False
        for c in chats:
            if c["id"] == chat_id:
                found = True
                lm = c.get("last_message")
                if lm and lm["content"] == "Hello World":
                    print("SUCCESS: Chat found with correct last message.")
                else:
                     print(f"FAILURE: Chat found but last_message is wrong: {lm}")
                
                # Check chat created_at timezone
                if "Z" in c['created_at'] or "+" in c['created_at']:
                    print("SUCCESS: Chat created_at has timezone info.")
                else:
                    print("FAILURE: Chat created_at is naive.")
                break
        
        if not found:
            print("FAILURE: Chat not found in list.")

if __name__ == "__main__":
    asyncio.run(main())
