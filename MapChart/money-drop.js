const moneyContainer = document.createElement('div');
moneyContainer.id = 'money-container';
document.body.appendChild(moneyContainer);

const currencySymbols = ['$', '€', '£', '¥', '💵', '💸', '💰'];

function createMoney() {
    const money = document.createElement('div');
    money.classList.add('falling-money');
    money.innerText = currencySymbols[Math.floor(Math.random() * currencySymbols.length)];

    // Random horizontal position
    money.style.left = Math.random() * 100 + 'vw';

    // Random animation duration (falling speed)
    money.style.animationDuration = Math.random() * 3 + 2 + 's'; // 2s to 5s

    // Random size
    money.style.fontSize = Math.random() * 1.5 + 1 + 'rem';

    // Random opacity
    money.style.opacity = Math.random() * 0.5 + 0.3;

    moneyContainer.appendChild(money);

    // Remove element after animation finishes
    setTimeout(() => {
        money.remove();
    }, 5000);
}

// Create money every 300ms
setInterval(createMoney, 300);
