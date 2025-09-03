const shadow = document.getElementById('shadow');
const askbox = document.getElementById('askbox');
const askboxBody = document.getElementById('askbox-body');
var askbox_callback = null;

function askboxShow(title, items, callback) {
    askboxBody.innerHTML = '';
    document.getElementById('askbox-title').innerHTML = title;
    items.forEach(itm => {
        const id = itm.id;
        const name = itm.name;
        const ph = itm.placeholder || "";
        const def = itm.default || "";
        askboxBody.innerHTML += `<p><span>${name}</span><input id="askbox-body-${id}" type="text" value="${def}" placeholder="${ph}"/></p>`
    });
    shadow.style.display = 'block';
    askbox.style.display = 'flex';
    askbox_callback = callback
}

function askboxCancel() {
    shadow.style.display = 'none';
    askbox.style.display = 'none';
}

function askboxConfirm(callback) {
    const ret = {};
    askboxBody.querySelectorAll('input').forEach(input => {
        const key = input.id.replace('askbox-body-', '');
        ret[key] = input.value;
    });
    askboxCancel();
    if(askbox_callback) {
        askbox_callback(ret);
    }
}