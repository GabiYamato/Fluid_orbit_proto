import asyncio
import aiohttp
from aiohttp import ClientTimeout
from typing import List
import ssl
import certifi

SITES = [
    "express.com",
    "urbanoutfitters.com",
    "oldnavy.gap.com",
    "asos.com",
    "uspoloassn.com",
    "garageclothing.com",
    "bananarepublicfactory.gapfactory.com",
    "hm.com",
    "abercrombie.com",
    "edikted.com",
    "hollisterco.com",
    "altardstate.com",
    "ae.com",
    "macys.com",
    "nordstrom.com",
    "saksfifthavenue.com",
    "uniqlo.com",
    "saksoff5th.com",
    "thereformation.com",
    "everlane.com",
    "jcrew.com",
    "madewell.com",
    "anthropologie.com",
    "eloquii.com",
    "girlfriend.com",
    "shop.lululemon.com",
    "aloyoga.com",
    "banditrunning.com",
    "carbon38.com",
    "pistoladenim.com",
    "thefrankieshop.com",
    "aritzia.com",
    "shopbop.com",
    "wolfandbadger.com",
    "revolve.com",
    "farfetch.com",
]

# normalize and dedupe, ensure scheme
def normalize(urls: List[str]) -> List[str]:
    seen = set()
    out = []
    for u in urls:
        if not u.startswith("http://") and not u.startswith("https://"):
            u = "https://" + u
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out

async def fetch(session: aiohttp.ClientSession, url: str, sem: asyncio.Semaphore):
    async with sem:
        try:
            timeout = ClientTimeout(total=25)
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; StartupStuffBot/1.0; +https://example.com/bot)"
            }
            async with session.get(url, timeout=timeout, headers=headers, allow_redirects=True) as resp:
                text = await resp.text(errors="ignore")
                length = len(text.strip())
                return {"url": url, "status": resp.status, "length": length}
        except Exception as e:
            return {"url": url, "status": None, "length": 0, "error": str(e)}

async def main():
    urls = normalize(SITES)
    sem = asyncio.Semaphore(10)  # concurrency limit
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    connector = aiohttp.TCPConnector(ssl=ssl_context, limit_per_host=4)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [fetch(session, u, sem) for u in urls]
        results = await asyncio.gather(*tasks)

    empty_count = 0
    for r in results:
        if r.get("status") != 200 or r.get("length", 0) == 0:
            empty_count += 1
        # short per-site output (optional)
        print(f"{r['url']}: status={r.get('status')} length={r.get('length')}")

    print(f"\nTotal sites checked: {len(results)}")
    print(f"Sites that returned nothing / non-200: {empty_count}")

if __name__ == "__main__":
    asyncio.run(main())