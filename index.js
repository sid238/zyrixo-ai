const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());

app.post('/api/terabox', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto('https://teraboxdown.pages.dev/', { waitUntil: 'networkidle2' });
    await page.type('input[type="url"]', url);
    await page.click('button'); // assumes first button is "Fetch File"

    await page.waitForSelector('a[href^="https://download."]', { timeout: 10000 });

    const data = await page.evaluate(() => {
      const filename = document.querySelector('span:contains("Filename")')?.nextSibling?.textContent;
      const size = document.querySelector('span:contains("Size")')?.nextSibling?.textContent;
      const downloadLink = document.querySelector('a[href^="https://download."]')?.href;

      return { filename, size, downloadLink };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await browser.close();
  }
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));
