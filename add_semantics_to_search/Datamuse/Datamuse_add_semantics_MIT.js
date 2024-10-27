const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

// Функция для получения семантически близких терминов с API Datamuse
async function fetchRelatedTerms(query) {
    const apiUrl = `https://api.datamuse.com/words?ml=${query.toLowerCase()}`;

    try {
        const response = await axios.get(apiUrl);
        const relatedTermsData = response.data;
        let relatedTerms = new Set();

        // Добавляем семантически близкие термины в множество
        relatedTermsData.forEach(item => {
            const term = item.word;
            if (term.toLowerCase() !== query.toLowerCase()) {
                relatedTerms.add(term);
            }
        });

        return Array.from(relatedTerms); // Преобразуем Set в массив
    } catch (error) {
        console.error(`Ошибка при получении семантически близких терминов для "${query}": ${error}`);
        return [];
    }
}

// Функция для поиска по MIT OpenCourseWare
async function runSearchMIT(page, query) {
    await page.goto(`https://ocw.mit.edu/search/?q=${query}`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
    });

    try {
        await page.waitForSelector('span[id^="search-result-"][id$="-title"]', { timeout: 30000 });
    } catch (error) {
        console.error(`Ошибка при загрузке результатов для "${query}": ${error}`);
        return []; // Возвращаем пустой массив, если результаты не найдены
    }

    const results = await page.evaluate(() => {
        let elements = document.querySelectorAll('span[id^="search-result-"][id$="-title"]');
        let searchResults = [];

        elements.forEach((element) => {
            let title = element.innerText.toLowerCase();
            let linkElement = element.closest('a');
            let link = linkElement ? linkElement.href : '';

            if (link) {
                searchResults.push({
                    title: title,
                    link: link,
                });
            }
        });

        return searchResults;
    });

    return results;
}

// Функция для выполнения поиска по MIT OCW с семантически близкими терминами
async function runSearchWithRelatedTerms(page, query, relatedTermsList) {
    let totalExactMatches = 0; // Счетчик точных совпадений
    let exactMatchStatistics = []; // Массив для хранения статистики точных совпадений

    for (let relatedTerm of relatedTermsList) {
        const relatedResults = await runSearchMIT(page, relatedTerm);
        let exactMatchesForTerm = 0; // Счетчик точных совпадений для текущего термина

        for (const result of relatedResults) {
            const titleWords = result.title.split(' '); // Разделяем заголовок на слова
            if (titleWords.includes(query.toLowerCase())) {
                exactMatchesForTerm++;
                totalExactMatches++;
                break; // Выход из цикла после первого точного совпадения
            }
        }

        // Сохраняем статистику
        exactMatchStatistics.push(
            relatedTermsList.length > 0 ? (exactMatchesForTerm > 0 ? 1 : 0) : 0
        );
    }

    return { totalExactMatches, exactMatchStatistics };
}

// Функция для проведения тестов
async function runMITTests() {
    const queries = [
        'Biology', 'Mathematics', 'Physics', 'Chemistry', 'Programming',
        'Marketing', 'Design', 'History', 'Geography', 'Economics',
        'Business', 'Engineering', 'Psychology', 'Sociology', 'Accounting',
        'Finance', 'Statistics', 'Data', 'Blockchain', 'Leadership',
        'Management', 'Entrepreneurship', 'Creativity', 'Innovation', 'Robotics',
        'Machine', 'Learning', 'Artificial', 'Intelligence', 'Networking',
        'Security', 'Analysis', 'Visualization', 'Algebra', 'Geometry',
        'Calculus', 'Writing', 'Speaking', 'Communication', 'Cybersecurity',
        'Software', 'Web', 'Mobile', 'Cloud', 'Architecture',
        'Strategy', 'Education', 'Research', 'Teaching', 'Ethics'
    ];

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let totalQueries = queries.length;
    let totalExactMatches = 0;
    let overallExactMatchStatistics = []; // Массив для хранения общей статистики точных совпадений
    let totalRelatedTermsCount = 0; // Счетчик общего числа связанных терминов

    for (let query of queries) {
        let relatedTerms = await fetchRelatedTerms(query);
        totalRelatedTermsCount += relatedTerms.length; // Увеличиваем общий счетчик связанных терминов
        console.log(`\nQuery: "${query}"`);
        console.log(`Related terms: ${relatedTerms.length > 0 ? relatedTerms.join(', ') : 'нет семантически близких терминов'}`);

        // Выполняем поиск по MIT OCW для семантически близких терминов
        let { totalExactMatches: exactMatches, exactMatchStatistics } = await runSearchWithRelatedTerms(page, query, relatedTerms);

        // Сохраняем общее количество точных совпадений
        totalExactMatches += exactMatches;

        // Добавляем статистику текущего запроса в общий массив
        overallExactMatchStatistics = overallExactMatchStatistics.concat(exactMatchStatistics);
    }

    await browser.close(); // Закрываем браузер в конце

    // Вычисляем среднее значение точных совпадений
    const averageExactMatches = overallExactMatchStatistics.reduce((acc, val) => acc + val, 0) / overallExactMatchStatistics.length || 0;

    // Запись итоговых результатов в файл
    const output = `Total exact matches: ${totalExactMatches}\nAverage percent of exact matches: ${(averageExactMatches * 100).toFixed(2)}%\nTotal related terms: ${totalRelatedTermsCount}\n`;
    fs.writeFileSync('results.txt', output);

    console.log(`\nTotal exact matches: ${totalExactMatches}`);
    console.log(`Average percent of exact matches: ${(averageExactMatches * 100).toFixed(2)}%`);
    console.log(`Total related terms: ${totalRelatedTermsCount}`);
}

// Запуск тестов
runMITTests();
