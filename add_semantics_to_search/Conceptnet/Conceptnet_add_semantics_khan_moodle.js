const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const natural = require('natural');
const stemmer = natural.PorterStemmer;

async function fetchRelatedTerms(query) {
    try {
        const data = await fs.readFile('related_terms.txt', 'utf-8');
        const lines = data.split('\n');
        const relatedTerms = [];

        for (const line of lines) {
            const [term, terms] = line.split(':');
            if (term && terms && term.toLowerCase() === query.toLowerCase()) {
                relatedTerms.push(...terms.split(',').map(t => t.trim()));
            }
        }

        return [...new Set(relatedTerms)];
    } catch (error) {
        console.error(`Не удалось прочитать связанные термины для "${query}": ${error}`);
        return [];
    }
}

function stemWords(words) {
    return words.map(word => stemmer.stem(word.toLowerCase()));
}

async function runSearch(page, url, selector) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector(selector, { timeout: 60000 });

        const results = await page.evaluate(selector => {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements).map(element => {
                const title = element.innerText.toLowerCase();
                const linkElement = element.closest('a');
                const link = linkElement ? linkElement.href : '';
                return link ? { title, link } : null;
            }).filter(Boolean);
        }, selector);

        return results;
    } catch (error) {
        console.warn(`Ошибка при выполнении поиска: ${error.message}`);
        return [];
    }
}

async function runSearchKhan(term, browser) {
    let page;
    try {
        page = await browser.newPage();
        const url = `https://www.khanacademy.org/search?page_search_query=${term}`;
        const selector = '._16owliz9 a._xne4a47';
        const results = await runSearch(page, url, selector);
        return results.map(result => result.title.toLowerCase());
    } catch (error) {
        console.error(`Ошибка при поиске на Khan Academy для термина "${term}": ${error.message}`);
        return [];
    } finally {
        if (page) await page.close();
    }
}

async function runSearchMoodle(query, browser) {
    let page;
    try {
        page = await browser.newPage();
        await page.goto(`https://moodle.org/search/index.php?q=${query}`, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('.result-content', { timeout: 60000 });

        const results = await page.evaluate(() => {
            const elements = document.querySelectorAll('div.result-content');
            return Array.from(elements).map(element => {
                const linkElement = element.querySelector('a');
                const title = linkElement ? linkElement.innerText.toLowerCase() : '';
                const link = linkElement ? linkElement.href : '';
                return link ? { title, link } : null;
            }).filter(Boolean);
        });

        return results;
    } catch (error) {
        console.error(`Ошибка при поиске на Moodle для запроса "${query}": ${error.message}`);
        return [];
    } finally {
        if (page) await page.close();
    }
}

async function runTests() {
    const queries = ['Biology'];
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });

    for (let query of queries) {
        const relatedTerms = await fetchRelatedTerms(query);
        console.log(`Количество связанных терминов для "${query}": ${relatedTerms.length}`);

        let totalKhanMatches = 0;
        let totalMoodleMatches = 0;

        for (let term of relatedTerms) {
            const khanResults = await runSearchKhan(term, browser);
            if (khanResults.length > 0) totalKhanMatches++;
            console.log(`Total Khan Matches после "${term}": ${totalKhanMatches}`);

            const moodleResults = await runSearchMoodle(term, browser);
            if (moodleResults.length > 0) totalMoodleMatches++;
            console.log(`Total Moodle Matches после "${term}": ${totalMoodleMatches}`);
        }

        const khanPercentage = (totalKhanMatches / relatedTerms.length) * 100 || 0;
        const moodlePercentage = (totalMoodleMatches / relatedTerms.length) * 100 || 0;

        console.log(`Khan Academy: ${khanPercentage.toFixed(2)}%, Moodle: ${moodlePercentage.toFixed(2)}%`);

        const summary = `Results for "${query}": Khan Academy: ${khanPercentage.toFixed(2)}%, Moodle: ${moodlePercentage.toFixed(2)}%\n`;
        await fs.appendFile('averages_moodle_khan.txt', summary);
    }

    await browser.close();
}

runTests();
