const puppeteer = require('puppeteer');
const axios = require('axios'); // Используем axios для запросов к API

// Функция для поиска семантически близких слов через API ConceptNet
async function fetchSemanticWords(query) {
    const apiUrl = `https://api.conceptnet.io/c/en/${query.toLowerCase()}?offset=0&limit=5`;

    try {
        const response = await axios.get(apiUrl);
        const edges = response.data.edges;
        let semanticWords = [];

        // Обрабатываем результат и находим семантически близкие слова
        edges.forEach(edge => {
            const term = edge.end.label || edge.start.label;
            if (term.toLowerCase() !== query.toLowerCase()) {
                semanticWords.push(term);
            }
        });

        return semanticWords;
    } catch (error) {
        console.error(`Не удалось получить семантически близкие слова для термина "${query}": ${error}`);
        return [];
    }
}

// Функция для выполнения поиска и анализа
async function runSearch(query, semanticWordsList) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Открываем страницу поиска
    await page.goto(`https://www.khanacademy.org/search?page_search_query=${query}`, {
        waitUntil: 'networkidle2',
    });

    // Ждем появления результатов
    await page.waitForSelector('._16owliz9');

    // Извлекаем результаты
    const results = await page.evaluate(() => {
        let elements = document.querySelectorAll('._16owliz9 a._xne4a47');
        let searchResults = [];

        elements.forEach((element) => {
            let link = element.href;
            let title = element.querySelector('._2dibcm7')?.innerText || '';
            let description = element.querySelector('._w68pn83')?.innerText || '';
            searchResults.push({
                title: title.toLowerCase(), // Приводим к нижнему регистру для удобства сравнения
                link: link,
                description: description,
            });
        });

        return searchResults;
    });

    await browser.close();

    let exactMatches = 0;
    let semanticMatches = 0;

    // Анализ результатов
    results.forEach((result) => {
        const title = result.title;

        // Проверка на точное совпадение с исходным запросом
        if (title.includes(query.toLowerCase())) {
            exactMatches++;
        } else {
            // Проверка на совпадение с семантически близкими словами
            semanticWordsList.forEach((semanticWord) => {
                if (title.includes(semanticWord.toLowerCase())) {
                    semanticMatches++;
                }
            });
        }
    });

    return { exactMatches, semanticMatches, totalResults: results.length };
}

// Основная функция для запуска нескольких запросов и вывода статистики
async function runSearchTests() {
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

    let totalQueries = queries.length;
    let totalExactMatches = 0;
    let totalSemanticMatches = 0;

    for (let query of queries) {
        // Получаем семантически близкие слова для каждого запроса
        let semanticWords = await fetchSemanticWords(query);
        
        // Выводим семантически близкие слова для текущего запроса
        console.log(`\nЗапрос: "${query}"`);
        console.log(`Семантически близкие слова: ${semanticWords.length > 0 ? semanticWords.join(', ') : 'Не найдено'}`);

        // Выполняем поиск и анализ
        let { exactMatches, semanticMatches, totalResults } = await runSearch(query, semanticWords);

        console.log(`Результаты поиска для запроса "${query}":`);
        console.log(`Всего результатов: ${totalResults}`);
        console.log(`Точные совпадения: ${exactMatches}`);
        console.log(`Совпадения с семантически близкими словами: ${semanticMatches}`);

        // Увеличиваем общие показатели
        if (exactMatches > 0) {
            totalExactMatches += 1;
        }
        if (semanticMatches) {
            totalSemanticMatches += 1;
        }
    }

    // Итоговая статистика
    console.log(`\nИз ${totalQueries} запросов:`);
    console.log(`Точные совпадения: ${totalExactMatches} (${(totalExactMatches / totalQueries) * 100}%)`);
    console.log(`Совпадения с семантически близкими словами: ${totalSemanticMatches} (${(totalSemanticMatches / totalQueries) * 100}%)`);
}

// Запуск поиска
runSearchTests();
