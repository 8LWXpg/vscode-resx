// @ts-check

// @ts-ignore
const vscode = acquireVsCodeApi();

const notesContainer = /** @type {HTMLElement} */ (document.querySelector('tbody'));

/**
 * @param {{value: string, comment?: string, '@_name': string}[]} obj
 */
function postUpdate(obj) {
	vscode.setState({ obj: obj });
	vscode.postMessage({
		type: 'update',
		obj: obj,
	});
}

function inputEvent() {
	let obj = [];
	let a = notesContainer.querySelectorAll('tr');
	for (let rule of a) {
		// @ts-ignore
		let /** @type {HTMLCollectionOf<HTMLInputElement|HTMLTextAreaElement>} */ inputs = rule.getElementsByClassName('input');
		if (inputs[0].value && inputs[1].value) {
			obj.push({
				'@_name': inputs[0].value,
				value: inputs[1].value,
				comment: inputs[2].value === '' ? undefined : inputs[2].value,
			});
		}
	}
	postUpdate(obj);
}

function deleteEvent(self) {
	self.remove();
	inputEvent();
}

function addContent() {
	const element = document.createElement('tr');
	notesContainer.appendChild(element);
	element.innerHTML = rowHtml('', '', '');
	element.scrollIntoView();
}

/**
 * returns the html for a row
 * @param {string} name
 * @param {string} value
 * @param {string} comment
 * @returns {string}
 */
function rowHtml(name, value, comment) {
	return /* html */ `
<td><input class="input" id="col0" oninput="inputEvent()" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" value="${name}"></td>
<td><textarea class="input" id="col1" oninput="inputEvent()" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" rows="1">${value}</textarea></td>
<td><textarea class="input" id="col2" oninput="inputEvent()" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" rows="1">${comment}</textarea></td>
<td><div class="drop" onclick="deleteEvent(this.parentElement.parentElement)">✖</div></td>
`;
}

/**
 * @param {{value: string, comment?: string, '@_name': string}[]} obj obj
 */
function updateContent(obj) {
	notesContainer.innerHTML = '';
	obj.forEach((ele) => {
		const comment = (ele?.comment || '').replaceAll('"', '&quot;');
		const value = ele.value.replaceAll('"', '&quot;');
		const element = document.createElement('tr');
		notesContainer.appendChild(element);
		element.innerHTML = rowHtml(ele['@_name'], value, comment);
	});
}

// Handle keyboard navigation
/**
 * 
 * @param {KeyboardEvent} e 
 * @param {HTMLElement} input 
 * @returns 
 */
function handleKeyEvent(e, input) {
	if (!e.ctrlKey) { return; }
	let /** @type {HTMLInputElement | HTMLTextAreaElement | null | undefined} */ next;
	switch (e.key) {
		case 'ArrowUp': {
			e.preventDefault();
			const tr = input.parentElement?.parentElement;
			next = tr?.previousElementSibling?.querySelector(`td #${input.id}`);
			break;
		}
		case 'Enter':
		case 'ArrowDown': {
			e.preventDefault();
			const tr = input.parentElement?.parentElement;
			next = tr?.nextElementSibling?.querySelector(`td #${input.id}`);
			break;
		}
		case 'ArrowLeft': {
			e.preventDefault();
			next = input.parentElement?.previousElementSibling?.querySelector('.input');
			break;
		}
		case 'ArrowRight': {
			e.preventDefault();
			next = input.parentElement?.nextElementSibling?.querySelector('.input');
			break;
		}
		default:
			break;
	}
	if (next) {
		const end = next.value.length;
		next.setSelectionRange(0, end);
		next.focus();
	}
}

let sortFlags = {
	'@_name': true,
	value: true,
	comment: true,
};

/**
 * @param { 'value' | 'comment' | '@_name' } key
 */
function sortObject(self, key) {
	let /** @type {{value: string, comment?: string, '@_name': string}[]} obj */ obj = vscode.getState()?.obj;
	obj.sort((a, b) => (b[key] || '').localeCompare(a[key] || ''));

	if (sortFlags[key]) {
		self.setAttribute('aria-sort', 'descending');
	} else {
		obj.reverse();
		self.setAttribute('aria-sort', 'ascending');
	}
	sortFlags[key] = !sortFlags[key];
	updateContent(obj);
	postUpdate(obj);
}

function sortName(self) {
	sortObject(self, '@_name');
}

function sortValue(self) {
	sortObject(self, 'value');
}

function sortComment(self) {
	sortObject(self, 'comment');
}

// Handle messages sent from the extension to the webview
window.addEventListener('message', (event) => {
	const message = event.data; // The json data that the extension sent
	switch (message.type) {
		case 'update':
			// use the object that represents the document to track the state of the webview
			const obj = message.obj;
			updateContent(obj);
			vscode.setState({ obj: obj });
			return;
	}
});

// Webview are normally torn down when not visible and re-created when they become visible again.
// State lets us save information across these re-loads
const state = vscode.getState();
if (state) {
	updateContent(state.obj);
}
