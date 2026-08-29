// @ts-check
import udomdiff from 'udomdiff';

/**
 * @typedef {{ '@_name': string; value: string; comment?: string }} XMLData
 *
 * @typedef {{ obj: XMLData[] }} State
 */

//#region Setup
// @ts-ignore
const vscode = acquireVsCodeApi();

const container = /** @type {HTMLTableSectionElement} */ (document.querySelector('tbody'));
//#endregion

//#region Backend messaging
/** @param {XMLData[]} obj */
function setStateAndPostUpdate(obj) {
	vscode.setState({ obj: obj });
	vscode.postMessage({ type: 'update', obj: obj });
}
//#endregion

//#region Row DOM construction
/** @param {HTMLTableRowElement} row */
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
 * @param {number} index
 * @param {string} name
 * @param {string} value
 * @param {string} comment
 * @returns {HTMLTableRowElement} Keyed by `name`
 */
function buildRow(index, name, value, comment) {
	function rowHtml() {
		const n = name.replaceAll('"', '&quot;');
		const v = value.replaceAll('"', '&quot;');
		const c = comment.replaceAll('"', '&quot;');
		return /* html */ `
<td class="handle" draggable="true" ondragstart="handleDragStart(event)" ondragend="handleDragEnd()">≡</td>
<td><input class="input" id="name" oninput="inputEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" value="${n}"></td>
<td><textarea rows="1" class="input" id="value" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)">${v}</textarea></td>
<td><textarea rows="1" class="input" id="comment" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)">${c}</textarea></td>
<td class="drop" onclick="deleteEvent(this.parentElement)">✖</td>
`;
	}

	const row = document.createElement('tr');
	row.ondragover = handleDragOver;
	row.innerHTML = rowHtml();
	row.setAttribute('data-index', index.toString());
	row.setAttribute('data-name', name);
	// scrollHeight is 0 while detached; caller must resize() after attaching
	return row;
}

//#endregion

//#region Table content update
// Reuses existing rows instead of rebuilding, so untouched rows keep scroll position and focus.
/** @param {XMLData[]} obj */
function updateContent(obj) {
	const oldRows = /** @type {HTMLTableRowElement[]} */ (Array.from(container.children));
	const oldKeys = oldRows.map((row) => row.getAttribute('data-name'));
	const newKeys = obj.map((ele) => ele['@_name']);

	// Only one field can be focused at a time, so a same-length, single-index name change is a rename.
	/** @returns {number} The renamed index, or -1 if this isn't a simple rename */
	function detectRename() {
		if (oldKeys.length !== newKeys.length) {
			return -1;
		}
		let diffAt = -1;
		for (let i = 0; i < oldKeys.length; i++) {
			if (oldKeys[i] !== newKeys[i]) {
				if (diffAt !== -1) {
					return -1;
				}
				diffAt = i;
			}
		}
		return diffAt;
	}

	/**
	 * @param {HTMLTableRowElement} row
	 * @param {XMLData} data
	 * @param {number} index
	 */
	function patchRow(row, data, index) {
		row.setAttribute('data-index', index.toString());
		const name = /** @type {HTMLInputElement} */ (row.querySelector('#name'));
		const value = /** @type {HTMLTextAreaElement} */ (row.querySelector('#value'));
		const comment = /** @type {HTMLTextAreaElement} */ (row.querySelector('#comment'));
		let modified = false;
		if (name.value !== data['@_name']) {
			name.value = data['@_name'];
			modified = true;
		}
		if (value.value !== data.value) {
			value.value = data.value;
			modified = true;
		}
		if (comment.value !== (data.comment || '')) {
			comment.value = data.comment || '';
			modified = true;
		}
		if (modified) {
			resize(row);
		}
	}

	const renameAt = detectRename();
	if (renameAt !== -1) {
		oldRows[renameAt].setAttribute('data-name', newKeys[renameAt]);
		oldKeys[renameAt] = newKeys[renameAt];
	}

	const byName = new Map(oldRows.map((row, i) => [oldKeys[i], row]));
	/** @type {HTMLTableRowElement[]} */
	const createdRows = [];
	const newRows = obj.map((ele, i) => {
		const row = byName.get(ele['@_name']);
		if (row) {
			patchRow(row, ele, i);
			return row;
		}
		const created = buildRow(i, ele['@_name'], ele.value, ele.comment || '');
		createdRows.push(created);
		return created;
	});

	udomdiff(container, oldRows, newRows, (row) => row);
	// resize() needs these attached first, which udomdiff just did
	createdRows.forEach(resize);
}
//#endregion

//#region Row field edits
// Used by inline oninput/onclick/onkeydown attributes in rowHtml()'s markup.

function inputEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const index = self.getAttribute('data-index');
	const name = self.querySelector('#name').value;
	obj[index]['@_name'] = name;
	setStateAndPostUpdate(obj);
}

function textareaEvent(self) {
	resize(self);
	/** @type {State} */
	let { obj } = vscode.getState();
	const index = self.getAttribute('data-index');
	const value = self.querySelector('#value').value || '';
	const comment = self.querySelector('#comment').value || undefined;
	obj[index].value = value;
	obj[index].comment = comment;
	setStateAndPostUpdate(obj);
}

/** @param {HTMLTableRowElement} self */
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

function addContent() {
	/** @type {XMLData[]} */
	const obj = vscode.getState().obj;
	const row = buildRow(obj.length, '', '', '');
	container.appendChild(row);
	resize(row);
	obj.push({ '@_name': '', value: '' });
	row.scrollIntoView();
	setStateAndPostUpdate(obj);
}

/**
 * @param {KeyboardEvent} e
 * @param {HTMLElement} input
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
//#endregion

//#region Drag to reorder
// handleDragStart and handleDragEnd are invoked from the handle's ondragstart/ondragend in rowHtml().

/** @type {HTMLTableRowElement | null} */
let dragging;

/** @param {DragEvent} event */
function handleDragStart(event) {
	// @ts-ignore
	dragging = event.target.closest('tr');
	dragging?.classList.add('dragging');
}

/** @param {DragEvent} event */
function handleDragOver(event) {
	event.preventDefault();

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
//#endregion

//#region Column sorting
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

// Called from the <th> onclick handlers.
function sortName(self) {
	sortObject(self, '@_name');
}

function sortValue(self) {
	sortObject(self, 'value');
}

function sortComment(self) {
	sortObject(self, 'comment');
}
//#endregion

//#region Bootstrap
window.addEventListener('message', (event) => {
	const message = event.data;
	switch (message.type) {
		case 'update':
			const obj = message.obj;
			updateContent(obj);
			vscode.setState({ obj });
			console.log('update', obj);
			return;
	}
});

// Restores content across the tear-down/re-create cycle when the webview loses visibility.
const state = vscode.getState();
if (state) {
	updateContent(state.obj);
}

// Bundling wraps this file in an IIFE, so these need re-exposing for the inline on* attributes.
Object.assign(window, {
	inputEvent,
	textareaEvent,
	deleteEvent,
	handleKeyEvent,
	handleDragStart,
	handleDragEnd,
	addContent,
	sortName,
	sortValue,
	sortComment,
});
//#endregion
