import asyncio, websockets, json

async def test():
    try:
        ws = await asyncio.wait_for(websockets.connect("ws://localhost:8766"), timeout=3)
        # Wait for symbols message
        msg1 = await asyncio.wait_for(ws.recv(), timeout=3)
        d1 = json.loads(msg1)
        print("MSG1 type=" + str(d1.get("type")) + " symbols=" + str(d1.get("symbols",[])))
        
        # Wait for potential book snapshot
        try:
            msg2 = await asyncio.wait_for(ws.recv(), timeout=5)
            d2 = json.loads(msg2)
            print("MSG2 type=" + str(d2.get("type")) + " bids=" + str(len(d2.get("bids",[]))) + " asks=" + str(len(d2.get("asks",[]))))
        except asyncio.TimeoutError:
            print("MSG2: TIMEOUT - no hay datos de OrderBook disponibles")
        
        await ws.close()
    except Exception as e:
        print("ERROR: " + str(e))

asyncio.run(test())
