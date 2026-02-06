import asyncio
from crawl4ai import AsyncWebCrawler

async def main():
    async with AsyncWebCrawler(verbose=True) as crawler:
        
        result = await crawler.crawl("https://shop.lululemon.com/")
        print(result.json())

if __name__ == "__main__":
    asyncio.run(main())