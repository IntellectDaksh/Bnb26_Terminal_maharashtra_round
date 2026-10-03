import asyncio
import fakeredis

async def main():
    r = fakeredis.FakeAsyncRedis(decode_responses=True)
    lua = "return 1"
    s = r.register_script(lua)
    print(await s(keys=[]))

asyncio.run(main())
