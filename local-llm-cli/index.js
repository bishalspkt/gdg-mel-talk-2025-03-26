const readline = require('readline');

const BASE_URL = "http://localhost:11434/v1/chat/completions";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


rl.question('How can I help:  ', (prompt) => {
    fetch(BASE_URL, {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
            model: "gemma3:1b",
            messages: [{ role: "user", content: prompt }],
        }),
    })
    .then(res => res.json())
    .then(data => {
        console.log(data.choices[0].message.content);
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => rl.close());
});

