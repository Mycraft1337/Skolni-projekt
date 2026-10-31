console.log("Counter connected");
const score1Display = document.getElementById("score_1");
const score2Display = document.getElementById("score_2");
const player1AddButton = document.getElementById("add_button_1");
const player2AddButton = document.getElementById("add_button_2");
const player1SubtractButton = document.getElementById("subtract_button_1");
const player2SubtractButton = document.getElementById("subtract_button_2");
const buttonReset = document.getElementById("button_reset");

let score1 = 0;
let score2 = 0;
player1AddButton.addEventListener ("click", ()=>{
    score1++;
    score1Display.textContent = score1;
});
player2AddButton.addEventListener ("click", ()=>{
    score2++; 
    score2Display.textContent = score2;
});
player1SubtractButton.addEventListener ("click", ()=>{
    if (score1 > 0)
        {
            score1--;
        };
    score1Display.textContent = score1;
});
player2SubtractButton.addEventListener ("click", ()=>{
    if (score2 > 0)
        {
            score2--;
        }; 
    score2Display.textContent = score2;
});
buttonReset.addEventListener("click", () => {
    score1 = 0;
    score2 = 0;
    score1Display.textContent = score1;
    score2Display.textContent = score2;
});
