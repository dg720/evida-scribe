from fastapi import FastAPI, Request

app = FastAPI()


@app.post("/webhook/meeting-provider")
async def meeting_provider_webhook(request: Request):
    """
    Stub endpoint for future meeting provider integration.
    Currently does nothing beyond echoing the payload.
    """
    payload = await request.json()
    return {"status": "stub", "received": payload}
