// @ts-check

/**
 * @typedef {{ '@_name': string; value: string; comment?: string }} XMLData
 *
 * @typedef {{ obj: XMLData[] }} State
 */

// @ts-ignore
const vscode = acquireVsCodeApi();

const container = /** @type {HTMLTableSectionElement} */ (document.querySelector('tbody'));
/** @type {HTMLTableRowElement | null} */
let dragging;

/** Handle the input event for inputs, trickier because name must be unique */
function inputEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const index = self.getAttribute('data-index');
	const name = self.querySelector('#name').value;
	obj[index]['@_name'] = name;
	setStateAndPostUpdate(obj);
}

/** Handle the input event for textarea */
function textareaEvent(self) {
	resize(self);
	/** @type {State} */
	let { obj } = vscode.getState();
	const index = self.getAttribute('data-index');
	const value = self.querySelector('#value').value || undefined;
	const comment = self.querySelector('#comment').value || undefined;
	obj[index].value = value;
	obj[index].comment = comment;
	setStateAndPostUpdate(obj);
}

/**
 * Calls on click delete
 *
 * @param {HTMLTableRowElement} self
 */
function deleteEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	// @ts-ignore
	const index = Number.parseInt(self.getAttribute('data-index'));
	obj.splice(index, 1);
	self.remove();
	Array.prototype.forEach.call(container.getElementsByTagName('tr'), (e, i) => {
		e.setAttribute('data-index', i.toString());
	});
	setStateAndPostUpdate(obj);
}

/** @param {DragEvent} event */
function handleDragStart(event) {
	// event.dataTransfer.effectAllowed = 'move';
	// @ts-ignore
	dragging = event.target.closest('tr');
	dragging?.classList.add('dragging');
}

/** @param {DragEvent} event */
function handleDragOver(event) {
	event.preventDefault(); // Allow dropping

	// @ts-ignore
	const draggingIndex = Number.parseInt(dragging.getAttribute('data-index'));
	// @ts-ignore
	const targetRow = event.target.closest('tr');
	const targetIndex = Number.parseInt(targetRow.getAttribute('data-index'));
	if (targetIndex > draggingIndex) {
		targetRow.after(dragging);
	} else {
		targetRow.before(dragging);
	}
	dragging?.setAttribute('data-index', targetIndex.toString());
	targetRow.setAttribute('data-index', draggingIndex.toString());

	/** @type {XMLData[]} */
	const obj = vscode.getState().obj;
	[obj[draggingIndex], obj[targetIndex]] = [obj[targetIndex], obj[draggingIndex]];
}

function handleDragEnd() {
	dragging?.classList.remove('dragging');
	dragging = null;
	setStateAndPostUpdate(vscode.getState().obj);
}

/**
 * Resize the row to fit the content
 *
 * @param {HTMLTableRowElement} row
 */
function resize(row) {
	/** @type {(HTMLInputElement | HTMLTextAreaElement)[]} */
	let inputs = Array.from(row.querySelectorAll('.input'));
	inputs.forEach((ele) => {
		ele.style.height = '5px';
	});
	let maxHeight = Math.max(...inputs.map((ele) => ele.scrollHeight));
	inputs.forEach((ele) => {
		ele.style.height = maxHeight + 'px';
	});
}

/**
 * Returns the html for a row
 *
 * @param {string} name
 * @param {string} value
 * @param {string} comment
 * @returns {string} Html
 */
function rowHtml(name, value, comment) {
	return /* html */ `
<td class="handle">≡</td>
<td><input class="input" id="name" oninput="inputEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" value="${name}"></td>
<td><textarea rows="1" class="input" id="value" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)">${value}</textarea></td>
<td><textarea rows="1" class="input" id="comment" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)">${comment}</textarea></td>
<td class="drop" onclick="deleteEvent(this.parentElement)">✖</td>
`;
}

/**
 * Create <tr> and append to `container` and returns it.
 *
 * @param {number} index
 * @param {string} name
 * @param {string} value
 * @param {string} comment
 * @returns {HTMLTableRowElement}
 */
function addRow(index, name, value, comment) {
	const row = document.createElement('tr');
	row.draggable = true;
	row.ondragstart = handleDragStart;
	row.ondragover = handleDragOver;
	row.ondragend = handleDragEnd;
	container.appendChild(row);
	row.innerHTML = rowHtml(name, value, comment);
	row.setAttribute('data-index', index.toString());
	resize(row);
	return row;
}

/** Calls on click add */
function addContent() {
	/** @type {XMLData[]} */
	const obj = vscode.getState().obj;
	const row = addRow(obj.length, '', '', '');
	obj.push({ '@_name': '', value: '' });
	row.scrollIntoView();
	setStateAndPostUpdate(obj);
}

/**
 * Update content of the table
 *
 * @param {XMLData[]} obj
 */
function updateContent(obj) {
	container.innerHTML = '';
	obj.forEach((ele, i) => {
		const comment = (ele.comment || '').replaceAll('"', '&quot;');
		const value = (ele.value || '').replaceAll('"', '&quot;');
		const row = addRow(i, ele['@_name'], value, comment);
		resize(row);
	});
}

/**
 * Handle keyboard navigation
 *
 * @param {KeyboardEvent} e
 * @param {HTMLElement} input
 * @returns
 */
function handleKeyEvent(e, input) {
	if (!e.ctrlKey) {
		return;
	}
	let /** @type {HTMLInputElement | HTMLTextAreaElement | null | undefined} */ next;
	switch (e.key) {
		case 'ArrowUp': {
			e.preventDefault();
			const tr = input.parentElement?.parentElement;
			next = tr?.previousElementSibling?.querySelector(`td #${input.id}`);
			break;
		}
		case 'ArrowDown': {
			e.preventDefault();
			const tr = input.parentElement?.parentElement;
			next = tr?.nextElementSibling?.querySelector(`td #${input.id}`);
			break;
		}
		case 'Enter': {
			if (e.shiftKey) {
				e.preventDefault();
				const tr = input.parentElement?.parentElement;
				next = tr?.previousElementSibling?.querySelector(`td #${input.id}`);
			} else {
				e.preventDefault();
				const tr = input.parentElement?.parentElement;
				next = tr?.nextElementSibling?.querySelector(`td #${input.id}`);
			}
			break;
		}
		default:
			break;
	}
	if (next) {
		next.focus();
	}
}

let sortFlags = {
	'@_name': true,
	value: true,
	comment: true,
};

/** @param {'value' | 'comment' | '@_name'} key */
function sortObject(self, key) {
	/** @type {XMLData[]} */
	let obj = vscode.getState()?.obj;
	obj.sort((a, b) => (b[key] || '').localeCompare(a[key] || ''));

	// Reset all other th elements
	const allHeaders = self.parentElement?.getElementsByTagName('th');
	for (const header of allHeaders) {
		if (header !== self) {
			header.removeAttribute('aria-sort');
		}
	}

	if (sortFlags[key]) {
		self.setAttribute('aria-sort', 'descending');
	} else {
		obj.reverse();
		self.setAttribute('aria-sort', 'ascending');
	}
	sortFlags[key] = !sortFlags[key];
	updateContent(obj);
	setStateAndPostUpdate(obj);
}

// Functions used by <th> elements to sort the table
function sortName(self) {
	sortObject(self, '@_name');
}

function sortValue(self) {
	sortObject(self, 'value');
}

function sortComment(self) {
	sortObject(self, 'comment');
}

/**
 * Update webview state then post an update message
 *
 * @param {XMLData[]} obj
 */
function setStateAndPostUpdate(obj) {
	vscode.setState({ obj: obj });
	vscode.postMessage({
		// update text in the file
		type: 'update',
		obj: obj,
	});
}

// Handle messages sent from the extension to the webview
window.addEventListener('message', (event) => {
	const message = event.data; // The json data that the extension sent
	switch (message.type) {
		case 'update':
			// use the object that represents the document to track the state of the webview
			const obj = message.obj;
			updateContent(obj);
			vscode.setState({ obj });
			console.log('update', obj);
			return;
	}
});

// Webview is normally torn down when not visible and re-created when they become visible again.
// State lets us save information across these re-loads
const state = vscode.getState();
if (state) {
	updateContent(state.obj);
}
