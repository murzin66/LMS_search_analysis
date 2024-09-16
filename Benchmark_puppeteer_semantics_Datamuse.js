const puppeteer = require('puppeteer');
const natural = require('natural'); // Для стемминга
const stemmer = natural.PorterStemmer; // Стеммер Портера
const fetch = require('node-fetch'); // Для выполнения HTTP-запросов

// Функция для поиска семантически близких слов через Datamuse API
async function fetchSemanticWords(query) {
    const url = `https://api.datamuse.com/words?rel_syn=${query}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Выводим результат запроса для диагностики
        console.log(`Запрос к Datamuse API: ${url}`);
        console.log('Ответ API:', data);

        // Возвращаем синонимы из ответа
        return data.map(item => item.word) || [];
    } catch (error) {
        console.error(`Не удалось получить семантически близкие слова для термина "${query}": ${error.message}`);
        return [];
    }
}

// Функция для выполнения поиска и анализа
async function runSearch(query, semanticWordsList) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const startTime = Date.now(); // Начало замера времени

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

    const endTime = Date.now(); // Конец замера времени
    const duration = (endTime - startTime) / 1000; // Время в секундах

    await browser.close();

    console.log(`Время выполнения запроса: ${duration} секунд`);

    // Применяем стемминг к запросу и семантически близким словам
    const queryStem = stemmer.stem(query.toLowerCase());
    const semanticStems = semanticWordsList.flatMap(word => word.split(' ').map(w => stemmer.stem(w.toLowerCase())));

    let exactMatches = 0;
    let semanticMatches = 0;

    // Анализ результатов
    results.forEach((result) => {
        const title = result.title;

        // Применяем стемминг к каждому слову заголовка
        const titleWords = title.split(' ').map(word => stemmer.stem(word));

        // Проверка на точное совпадение с исходным запросом (по стемму)
        if (titleWords.includes(queryStem)) {
            exactMatches++;
        } else {
            // Проверка на совпадение с семантически близкими словами (по стемму)
            semanticStems.forEach((semanticStem) => {
                if (titleWords.includes(semanticStem)) {
                    semanticMatches++;
                }
            });
        }
    });

    return { exactMatches, semanticMatches, totalResults: results.length, duration };
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
    let totalDuration = 0;

    for (let query of queries) {
        // Получаем семантически близкие слова для каждого запроса
        let semanticWords = await fetchSemanticWords(query);

        // Выводим семантически близкие слова для текущего запроса
        console.log(`\nЗапрос: "${query}"`);
        console.log(`Семантически близкие слова: ${semanticWords.length > 0 ? semanticWords.join(', ') : 'Не найдено'}`);

        // Выполняем поиск и анализ
        let { exactMatches, semanticMatches, totalResults, duration } = await runSearch(query, semanticWords);

        console.log(`Результаты поиска для запроса "${query}":`);
        console.log(`Всего результатов: ${totalResults}`);
        console.log(`Точные совпадения: ${exactMatches}`);
        console.log(`Совпадения с семантически близкими словами: ${semanticMatches}`);
        console.log(`Время выполнения запроса: ${duration.toFixed(2)} секунд`);

        // Увеличиваем общие показатели
        if (exactMatches > 0) {
            totalExactMatches += 1;
        }
        if (semanticMatches > 0) {
            totalSemanticMatches += 1;
        }
        totalDuration += duration;
    }

    // Итоговая статистика
    console.log(`\nИз ${totalQueries} запросов:`);
    console.log(`Точные совпадения: ${totalExactMatches} (${(totalExactMatches / totalQueries) * 100}%)`);
    console.log(`Совпадения с семантически близкими словами: ${totalSemanticMatches} (${(totalSemanticMatches / totalQueries) * 100}%)`);
    console.log(`Среднее время выполнения запроса: ${(totalDuration / totalQueries).toFixed(2)} секунд`);
}

// Запуск поиска
runSearchTests();
