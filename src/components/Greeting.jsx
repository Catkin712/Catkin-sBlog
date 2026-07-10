import { useState } from 'preact/hooks';

export default function Greeting({ messages }) {

    const randomMessage = () => messages[(Math.floor(Math.random() * messages.length))];

    const [greeting, setGreeting] = useState(messages[0]);

    return (
        <div>
            <h3>{greeting}向你问好~</h3>
            <button onClick={() => setGreeting(randomMessage())}>
                不喜欢Ta? 直接换！
            </button>
        </div>
    );
}