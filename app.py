from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

app = Flask(__name__)

def fetch_terabox_link(share_url):
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://teraboxdown.pages.dev/")

    # Input URL
    driver.find_element(By.CSS_SELECTOR, "input[type='url']").send_keys(share_url)
    driver.find_element(By.XPATH, "//button[contains(text(), 'Fetch File')]").click()
    time.sleep(5)  # Wait for data to load

    result = {}
    try:
        filename = driver.find_element(By.XPATH, "//span[contains(text(), 'Filename')]/following-sibling::*").text
        size = driver.find_element(By.XPATH, "//span[contains(text(), 'Size')]/following-sibling::*").text
        download_link = driver.find_element(By.XPATH, "//a[contains(text(), 'Download')]").get_attribute("href")
        result = {
            "filename": filename,
            "size": size,
            "download_link": download_link
        }
    except Exception as e:
        result = {"error": str(e)}
    finally:
        driver.quit()
        return result

@app.route("/api/terabox", methods=["POST"])
def terabox_api():
    data = request.get_json()
    url = data.get("url")
    if not url:
        return jsonify({"error": "Missing 'url' in request"}), 400
    result = fetch_terabox_link(url)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
