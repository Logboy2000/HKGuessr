// I import this file to prevent malicous/fake sites from embedding my game and profiting
if (window.top !== window.self) {
    window.top.location = window.location.href;
}