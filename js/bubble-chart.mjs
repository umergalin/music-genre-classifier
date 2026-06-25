import { getCSSVar } from "./utils.js";

export class BubbleChart {
    #gravity = 0.01;
    #friction = 0.95;
    #container;
    // #labels;
    #bubbles;
    #labelToBubble;
    #spawns;
    #center
    #previousTime;
    #stepFontSize;
    #maxPointGenre;
    #genres

    #MIN_FONT_SIZE = 22; // const
    #MAX_FONT_SIZE = 80; // const

    constructor(container, genres) {
        this.#container = container;
        // this.#labels = [...labels];
        this.#bubbles = [];
        this.#labelToBubble = new Map();

        this.#maxPointGenre = { genre: undefined, points: 0 };

        this.updateStepSize(60); // 60 - number of 3 sec segments in 3 min track

        this.#spawns = [];

        this.#center = document.createElement("div");
        this.#center.classList.add("chart-center");
        container.append(this.#center);

        this.#genres = genres;

        this.resize();

        this.#previousTime = 0;
        requestAnimationFrame(this.animate.bind(this));
    }

    reset() {
        for(const bubble of this.#bubbles) {
            console.log(bubble);
            this.#container.removeChild(bubble.element);
        }
        this.#bubbles = [];
        this.#labelToBubble.clear();
        this.#maxPointGenre = { genre: undefined, points: 0 };
    }

    getFinalGenre() {
        return this.#maxPointGenre.genre;
    }

    updateStepSize(steps) {
        this.#stepFontSize = (this.#MAX_FONT_SIZE - this.#MIN_FONT_SIZE) / steps;

        console.log("max size: " + this.#MAX_FONT_SIZE);
        console.log("steps: " + steps);
        console.log("step size: " + this.#stepFontSize);
    }

    addBubble(genreIndex) {
        const genre = this.#genres[genreIndex];

        console.log(`center x: ${this.#center.offsetLeft}, y: ${this.#center.offsetTop}`);
        if (this.#labelToBubble.has(genre.id)) {
            // update bubble
            const bubbleObj = this.#labelToBubble.get(genre.id);

            bubbleObj.fontSize += this.#stepFontSize;
            bubbleObj.element.style.fontSize = `${Math.round(bubbleObj.fontSize)}px`;

            if (bubbleObj.fontSize > this.#maxPointGenre.points) {
                this.#maxPointGenre.genre = genre.id;
                this.#maxPointGenre.points = bubbleObj.fontSize;
            }

            return;
        }

        const randomPoint = this.#spawns[Math.floor(Math.random() * this.#spawns.length)];
        const x = randomPoint.x;
        const y = randomPoint.y;

        const bubble = document.createElement("div");
        bubble.classList.add("bubble");

        bubble.style.backgroundColor = getCSSVar(`--${genre.id}-bg`);

        bubble.textContent = genre.emoji;
        console.log(`вставляю эмодзи ${genre.emoji} который соотвествует жанру ${genre.id}`);
        bubble.title = genre.label;

        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;

        // bubble.classList.add("fade-in");

        this.#container.append(bubble);

        bubble.offsetWidth; // forsing redrawing
        bubble.style.fontSize = `${this.#MIN_FONT_SIZE}px`;

        console.log(bubble.clientWidth); // надо обновлять радиус при пересчете кадра (по другому отслеживать сложнее)

        const bubbleObj = {
            element: bubble,
            pos: { x: x, y: y },
            vel: { x: 0, y: 0 },
            radius: 0,
            fontSize: this.#MIN_FONT_SIZE,
        };

        if (bubbleObj.fontSize > this.#maxPointGenre.points) {
            this.#maxPointGenre.genre = genre.id;
            this.#maxPointGenre.points = bubbleObj.fontSize;
        }

        this.#bubbles.push(bubbleObj);
        this.#labelToBubble.set(genre.id, bubbleObj);
    }

    resize() {
        this.#generateSpawnPoints();
    }

    #generateSpawnPoints() {
        this.#spawns = [];

        const minDistance = 100;

        const cX = this.#container.offsetLeft;
        const cY = this.#container.offsetTop;
        const cWidth = this.#container.clientWidth;
        const cHeight = this.#container.clientHeight;

        let hSegmentsCount = Math.max(1, Math.floor(cWidth / minDistance));
        let hDistance = minDistance + (cWidth % minDistance) / hSegmentsCount;

        let vSegmentsCount = Math.max(1, Math.floor(cHeight / minDistance));
        let vDistance = minDistance + (cHeight % minDistance) / vSegmentsCount;

        let x = cX, y = cY;
        for (let i = 0; i < hSegmentsCount; i++) {
            this.#spawns.push({ x: Math.round(x), y: y });
            x += hDistance;
        }

        // right
        x = cX + cWidth;
        for (let i = 0; i < vSegmentsCount; i++) {
            this.#spawns.push({ x: x, y: Math.round(y) });
            y += vDistance;
        }

        // bottom
        y = cY + cHeight;
        for (let i = 0; i < hSegmentsCount; i++) {
            this.#spawns.push({ x: Math.round(x), y: y });
            x -= hDistance;
        }

        // left
        x = cX;
        for (let i = 0; i < vSegmentsCount; i++) {
            this.#spawns.push({ x: x, y: Math.round(y) });
            y -= vDistance;
        }
    }

    #checkCollisions() {
        for (let i = 0; i < this.#bubbles.length; i++) {
            for (let j = i + 1; j < this.#bubbles.length; j++) {
                const b1 = this.#bubbles[i];
                const b2 = this.#bubbles[j];
                const dx = b1.pos.x - b2.pos.x;
                const dy = b1.pos.y - b2.pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = b1.radius + b2.radius;

                if (distance < minDistance) {
                    // Если пузыри пересекаются, отталкиваем их
                    const angle = Math.atan2(dy, dx);
                    const overlap = minDistance - distance;
                    const force = overlap * 0.5;

                    b1.vel.x += Math.cos(angle) * force;
                    b1.vel.y += Math.sin(angle) * force;
                    b2.vel.x -= Math.cos(angle) * force;
                    b2.vel.y -= Math.sin(angle) * force;
                }
            }
        }
    }
    
    animate(currentTime) {
        const deltaTime = (currentTime - this.#previousTime) / 1000;
        this.#previousTime = currentTime;

        this.#bubbles.forEach(b => {
            // обновление радиусов 
            b.radius = b.element.clientWidth / 2;

            // Гравитация к центру
            const dx = this.#center.offsetLeft - b.pos.x;
            const dy = this.#center.offsetTop - b.pos.y;
            b.vel.x += dx * this.#gravity;
            b.vel.y += dy * this.#gravity;

            // Обновляем позицию
            b.pos.x += b.vel.x;
            b.pos.y += b.vel.y;

            // Применяем трение
            b.vel.x *= this.#friction;
            b.vel.y *= this.#friction;

            // preventing from leaving container
            const c = this.#container;
            b.pos.x = Math.max(
                c.offsetLeft + b.radius,
                Math.min(c.offsetLeft + c.offsetWidth - b.radius, b.pos.x)
            );
            b.pos.y = Math.max(
                c.offsetTop + b.radius,
                Math.min(c.offsetTop + c.offsetHeight - b.radius, b.pos.y)
            );

            // Обновляем позицию на экране
            b.element.style.left = `${b.pos.x}px`;
            b.element.style.top = `${b.pos.y}px`;
        });

        // Проверяем столкновения
        this.#checkCollisions();

        requestAnimationFrame(this.animate.bind(this));
    }
}