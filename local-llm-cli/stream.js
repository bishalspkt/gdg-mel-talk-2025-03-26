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
            stream: true
        }),
    })
    .then(res => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        function readStream() {
            reader.read().then(({done, value}) => {
                if (done) {
                    console.log('\n');
                    rl.close();
                    return;
                }
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') {
                            continue;
                        }
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.choices[0].delta.content) {
                                process.stdout.write(data.choices[0].delta.content);
                            }
                        } catch (err) {
                            console.error('Error parsing JSON:', err);
                        }
                    }
                }
                
                readStream();
            }).catch(err => {
                console.error('Error reading stream:', err);
                rl.close();
            });
        }
        
        readStream();
    })
    .catch(err => {
        console.error('Error making request:', err);
        rl.close();
    });
});

