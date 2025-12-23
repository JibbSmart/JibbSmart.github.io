// JSermonEdit, for better sermon writing iteration. Copyright 2025 Jibb Smart
// <div contenteditable="true" id="tableOfContents"></div>
// <div contenteditable="true" id="userDoc"></div>

const tableOfContents = document.getElementById("tableOfContents");
const userDoc = document.getElementById("userDoc");

const headingToTOC = new Map();
const headingToDoc = new Map();

const promotionMap = new Map([
	["H2", "h1"],
	["H3", "h2"],
	["H4", "h3"],
	["P", "h4"]
]);

const demotionMap = new Map([
	["H1", "h2"],
	["H2", "h3"],
	["H3", "h4"],
	["H4", "p"]
]);

const pLevel = 100;
const maxIndentLevel = 8;
const maxShowingLevel = 4;

const nodeNameToLevel = new Map([
	["H1", 0], ["h1", 0],
	["H2", 1], ["h2", 1],
	["H3", 2], ["h3", 2],
	["H4", 3], ["h4", 3],
	["P", pLevel], ["p", pLevel]
]);

const sanitizeMap = new Map([
	["H5", "h4"],
	["H6", "h4"],
	["SPAN", "."],
	["OL", "."],
	["UL", "."],
	["LI", "p"],
	["DIV", "p"]
]);

const nestableSet = new Set([
	"UL",
	"OL",
	"LI",
	"SPAN",
	"#text"
]);

const orderableSet = new Set([
	"H1",
	"H2",
	"H3",
	"H4",
	"P"
]);

const safeContentNodeTypes = new Set([
	"H1",
	"H2",
	"H3",
	"H4",
	"P",
	"#text",
	"BR"
]);

let showingLevel = maxShowingLevel;

let currentFileHandle = null;
let currentFileName = "";
const savedWithEditorTitle = "Editor Included";
const titleNoFile = "JSermonEdit";
const titleTail = " - " + titleNoFile;
const editorTitleTail = " - " + savedWithEditorTitle;
let isEditorBuiltInSession = false;
let defaultContent = "";

let caretViewportX = -1;
let caretViewportY = -1;

let topScrollMargin = 100;
let bottomScrollMargin = 100;
let topScrollTrigger = 25;
let bottomScrollTrigger = 25;

const currentSelection = {};
currentSelection.isValid = false;
currentSelection.selectionObject = document.getSelection();
currentSelection.startNode = currentSelection.selectionObject.anchorNode;
currentSelection.startElement = currentSelection.startNode;
currentSelection.startOffset = 0;
currentSelection.endNode = currentSelection.selectionObject.focusNode;
currentSelection.endElement = currentSelection.startNode;
currentSelection.endOffset = 0;
currentSelection.focusBeforeAnchor = false;
currentSelection.charBefore = null;

function copyCurrentSelection() {
	const newSelection = {};
	newSelection.isValid = currentSelection.isValid;
	newSelection.startNode = currentSelection.startNode;
	newSelection.startElement = currentSelection.startElement;
	newSelection.startOffset = currentSelection.startOffset;
	newSelection.endNode = currentSelection.endNode;
	newSelection.endElement = currentSelection.endElement;
	newSelection.endOffset = currentSelection.endOffset;
	newSelection.charBefore = currentSelection.charBefore;
	return newSelection;
}

function setCurrentSelection(otherSelection) {
	currentSelection.isValid = otherSelection.isValid;
	currentSelection.startNode = otherSelection.startNode;
	currentSelection.startElement = otherSelection.startElement;
	currentSelection.startOffset = otherSelection.startOffset;
	currentSelection.endNode = otherSelection.endNode;
	currentSelection.endElement = otherSelection.endElement;
	currentSelection.endOffset = otherSelection.endOffset;
	currentSelection.charBefore = otherSelection.charBefore;
}

function isSelection() {
	return !currentSelection.isValid ||
		currentSelection.startElement !== currentSelection.endElement ||
		currentSelection.startNode !== currentSelection.endNode ||
		currentSelection.startOffset !== currentSelection.endOffset;
}

function isSingleElementSelection() {
	return currentSelection.isValid && currentSelection.startElement === currentSelection.endElement;
}

function getStringIfTextNode(inNode) {
	if (inNode.nodeType === Node.TEXT_NODE) {
		return inNode.data;
	}
	return null;
}

function updateSelection() {
	const selectionObject = document.getSelection();
	currentSelection.selectionObject = selectionObject;
	if (currentSelection) {
		let focusBeforeAnchor = false;
		let selectionOrientationFound = false;
		if (selectionObject.anchorNode === selectionObject.focusNode) {
			focusBeforeAnchor = selectionObject.focusOffset < selectionObject.anchorOffset;
			selectionOrientationFound = true;
		} else if (selectionObject.anchorNode && selectionObject.focusNode) {
			const relativePosition = selectionObject.anchorNode.compareDocumentPosition(selectionObject.focusNode);
			if (relativePosition & Node.DOCUMENT_POSITION_PRECEDING) {
				focusBeforeAnchor = true;
				selectionOrientationFound = true;
			} else if (relativePosition & Node.DOCUMENT_POSITION_FOLLOWING) {
				focusBeforeAnchor = false;
				selectionOrientationFound = true;
			}
		}
		let startElement;
		let endElement;
		let startNode = selectionObject.anchorNode;
		let endNode = selectionObject.focusNode;
		let startOffset = selectionObject.anchorOffset;
		let endOffset = selectionObject.focusOffset;
		if (!selectionOrientationFound) {
			// probably one is a parent of the other
			startElement = getOrderableParent(startNode);
			endElement = getOrderableParent(endNode);
			if (startElement === endElement) {
				const startOffset = getOffsetInParentNode(startElement, startNode, startOffset);
				const endOffset = getOffsetInParentNode(endElement, endNode, endOffset);
				if (endOffset < startOffset) {
					focusBeforeAnchor = true;
					let temp = startElement;
					startElement = endElement;
					endElement = temp;

					temp = startNode;
					startNode = endNode;
					endNode = temp;

					temp = startOffset;
					startOffset = endOffset;
					endOffset = temp;
				}
				currentSelection.isValid = true;
			} else {
				currentSelection.isValid = false;
			}
		} else {
			if (focusBeforeAnchor) {
				startNode = selectionObject.focusNode;
				startOffset = selectionObject.focusOffset;
				endNode = selectionObject.anchorNode;
				endOffset = selectionObject.anchorOffset;
			} else {
				startNode = selectionObject.anchorNode;
				startOffset = selectionObject.anchorOffset;
				endNode = selectionObject.focusNode;
				endOffset = selectionObject.focusOffset;
			}
			startElement = getOrderableParent(startNode);
			endElement = getOrderableParent(endNode);
			currentSelection.isValid = (startElement && endElement);
		}
		currentSelection.focusBeforeAnchor = focusBeforeAnchor;
		currentSelection.startNode = startNode;
		currentSelection.startElement = startElement;
		currentSelection.startOffset = startOffset;
		currentSelection.endNode = endNode;
		currentSelection.endElement = endElement;
		currentSelection.endOffset = endOffset;
		currentSelection.charBefore = null;
		if (currentSelection.isValid && currentSelection.startNode.nodeType === Node.TEXT_NODE) {
			const startOffset = currentSelection.startOffset;
			const textData = currentSelection.startNode.data;
			if (startOffset <= textData.length && startOffset > 0) {
				currentSelection.charBefore = textData[startOffset - 1];
			}
		}
	} else {
		currentSelection.isValid = false;
		currentSelection.startNode = null;
		currentSelection.startElement = null;
		currentSelection.endNode = null;
		currentSelection.endElement = null;
		currentSelection.startOffset = 0;
		currentSelection.endOffset = 0;
		currentSelection.focusBeforeAnchor = false;
		currentSelection.charBefore = null;
	}

	return currentSelection.startElement;
}

function restoreSelection(pauseAndUnpauseUndo = false) {
	if (currentSelection.startNode && currentSelection.startNode.isConnected && currentSelection.endNode && currentSelection.endNode.isConnected) {
		if (pauseAndUnpauseUndo) {
			pauseUndoUpdates();
		}
		const newRange = document.createRange();
		newRange.setStart(currentSelection.startNode, currentSelection.startOffset);
		newRange.setEnd(currentSelection.endNode, currentSelection.endOffset);
		const newSelection = document.getSelection();
		newSelection.removeAllRanges();
		newSelection.addRange(newRange);
		if (pauseAndUnpauseUndo) {
			unpauseUndoUpdates();
		}
		return true;
	}
	return false;
}

function setSelectionFromMutatedNodes() {
	let earliestNode = null;
	let earliestOffset = 0;
	let latestNode = null;
	let latestOffset = 0;
	for (const [node, selection] of nodesAndOffsetsMutatedForSelection) {
		if (!node.isConnected) {
			continue;
		}

		if (!earliestNode) {
			earliestNode = node;
			earliestOffset = selection.start;
		} else {
			const relativePosition = earliestNode.compareDocumentPosition(node);
			if ((relativePosition & Node.DOCUMENT_POSITION_CONTAINED_BY) | (relativePosition & Node.DOCUMENT_POSITION_CONTAINS)) {
				// should share a common parent
				const earliestOrderable = getOrderableParent(earliestNode);
				const newOrderable = getOrderableParent(node);
				const earliestOffsetInOrderable = getOffsetInParentNode(earliestOrderable, earliestNode, earliestOffset);
				const newOffsetInOrderable = getOffsetInParentNode(newOrderable, node, selection.start);
				if (newOffsetInOrderable < earliestOffsetInOrderable) {
					earliestNode = node;
					earliestOffset = selection.start;
				} else if (newOffsetInOrderable === earliestOffsetInOrderable) {
					// favour more granular selection
					if (relativePosition & Node.DOCUMENT_POSITION_CONTAINED_BY) {
						earliestNode = node;
						earliestOffset = selection.start;
					}
				}
			} else if (relativePosition & Node.DOCUMENT_POSITION_PRECEDING) {
				// new earliest!
				earliestNode = node;
				earliestOffset = selection.start;
			}
		}

		if (!latestNode) {
			latestNode = node;
			latestOffset = selection.end;
		} else {
			const relativePosition = latestNode.compareDocumentPosition(node);
			if ((relativePosition & Node.DOCUMENT_POSITION_CONTAINED_BY) | (relativePosition & Node.DOCUMENT_POSITION_CONTAINS)) {
				// should share a common parent
				const latestOrderable = getOrderableParent(latestNode);
				const newOrderable = getOrderableParent(node);
				const latestOffsetInOrderable = getOffsetInParentNode(latestOrderable, latestNode, latestOffset);
				const newOffsetInOrderable = getOffsetInParentNode(newOrderable, node, selection.end);
				if (newOffsetInOrderable > latestOffsetInOrderable) {
					latestNode = node;
					latestOffset = selection.end;
				} else if (newOffsetInOrderable === latestOffsetInOrderable) {
					// favour more granular selection
					if (relativePosition & Node.DOCUMENT_POSITION_CONTAINED_BY) {
						latestNode = node;
						latestOffset = selection.end;
					}
				}
			} else if (relativePosition & Node.DOCUMENT_POSITION_FOLLOWING) {
				// new latest!
				latestNode = node;
				latestOffset = selection.end;
			}
		}
	}

	if (earliestNode && latestNode) {
		const newRange = document.createRange();
		newRange.setStart(earliestNode, earliestOffset);
		newRange.setEnd(latestNode, latestOffset);
		const newSelection = document.getSelection();
		newSelection.removeAllRanges();
		newSelection.addRange(newRange);
	}

	updateSelection();
	updateCaretViewportPosition();
	scrollToSelectedElementIfNeeded();
}

function pauseUndoUpdates() {
	userDoc.dataset.undoPaused = "true";
}

function unpauseUndoUpdates() {
	delete userDoc.dataset.undoPaused;
}

function updateCaretViewportPosition() {
	if (currentSelection && currentSelection.selectionObject) {
		const selectionRange = currentSelection.selectionObject.getRangeAt(0);
		if (selectionRange) {
			const selectionRects = selectionRange.getClientRects();
			const selectionRect = selectionRects.length > 0 ? selectionRects[0] : null;
			if (selectionRect && (selectionRect.left > 0 || selectionRect.bottom > 0)) {
				caretViewportX = (selectionRect.left + selectionRect.right) * 0.5;
				caretViewportY = Math.min(Math.max(selectionRect.bottom, 0), window.innerHeight);
			} else {
				caretViewportX = -1;
				caretViewportY = -1;
			}
		} else {
			caretViewportX = -1;
			caretViewportY = -1;
		}
	} else {
		caretViewportX = -1;
		caretViewportY = -1;
	}
}

function scrollToMaintainCaretViewportPosition() {
	if (caretViewportX > 0 || caretViewportY > 0) {
		// get difference in position
		let diffX = 0;
		let diffY = 0;
		const selectionObject = document.getSelection();
		if (selectionObject) {
			const selectionRange = selectionObject.getRangeAt(0);
			if (selectionRange) {
				const selectionRect = selectionRange.getBoundingClientRect();
				if (selectionRect && (selectionRect.left > 0 || selectionRect.bottom > 0)) {
					caretX = (selectionRect.left + selectionRect.right) * 0.5;
					caretY = selectionRect.bottom;

					diffX = caretX - caretViewportX;
					diffY = caretY - caretViewportY;
				}
			}
		}

		window.scrollBy({
			top: diffY,
			left: diffX,
			behavior: "instant",
		});
		caretViewportX = -1;
		caretViewportY = -1;
	}
}

function scrollToSelectedElementIfNeeded() {
	if (currentSelection && currentSelection.startElement) {
		let foundValidCaretInfo = false;
		const selectionRange = currentSelection.selectionObject.getRangeAt(0);
		if (selectionRange) {
			const selectionRect = selectionRange.getBoundingClientRect();
			if (selectionRect && (selectionRect.left != 0 || selectionRect.bottom != 0)) {
				const triggerTop = selectionRect.top < topScrollTrigger;
				const triggerBottom = selectionRect.bottom > window.innerHeight - bottomScrollTrigger;
				const safeSelectionSize = window.innerHeight - topScrollMargin - bottomScrollMargin;
				if (selectionRect.height >= safeSelectionSize) {
					if (currentSelection.focusBeforeAnchor) {
						if (triggerTop) {
							window.scrollBy({
								top: selectionRect.top - topScrollMargin,
								left: 0,
								behavior: "smooth",
							});
						}
					} else if (triggerBottom) {
						window.scrollBy({
							top: selectionRect.bottom - window.innerHeight + bottomScrollMargin,
							left: 0,
							behavior: "smooth",
						});
					}
				} else {
					if (triggerTop) {
						window.scrollBy({
							top: selectionRect.top - topScrollMargin,
							left: 0,
							behavior: "smooth",
						});
					} else if (triggerBottom) {
						window.scrollBy({
							top: selectionRect.bottom - window.innerHeight + bottomScrollMargin,
							left: 0,
							behavior: "smooth",
						});
					}
				}
				foundValidCaretInfo = true;
			}
		}
		if (!foundValidCaretInfo) {
			// just scroll to the element
			currentSelection.startElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
		}
	}
	caretViewportX = -1;
	caretViewportY = -1;
}

const undoStack = new Array();
const redoStack = new Array();

const inputEventNoCategory = 0;
const inputEventText = 1;
const inputEventEnter = 2;
const inputEventBackspace = 3;
const inputEventDel = 4;
const inputEventRemove = 5;
const inputEventMove = 6;
const inputEventPromote = 7;
const inputEventHide = 8;
const inputEventPaste = 9;
const inputEventMoveCaret = 10;
const inputEventUndoRedo = 11;
const inputEventToggleAltA = 12;
const inputEventToggleAltB = 13;

let currentInputType = inputEventNoCategory;
let previousInputType = inputEventNoCategory;

let doingUndo = false;
let doingRedo = false;
let undoPaused = false;
let needsNewUndo = true;
let needsNewRedo = true;

const nodeStatesRecordedForUndo = new Set();
const nodesAndOffsetsMutatedForSelection = new Map();

function finishUndo() {
	needsNewUndo = true;
	needsNewRedo = true;
	nodeStatesRecordedForUndo.clear();
}

function undoMutations(mutationList) {
	let wasSubstantial = false;
	const numMutations = mutationList.length;
	let mutationIdx = numMutations - 1;
	for (; mutationIdx >= 0; mutationIdx--) {
		const mutation = mutationList[mutationIdx];
		if (mutation.type === "childList") {
			wasSubstantial = true;
			let nodeBeforeRemove = null;
			let nodeAfterRemove = null;
			// remove the addeds...
			for (addedNode of mutation.addedNodes) {
				if (addedNode.parentNode === mutation.target) {
					if (!nodeBeforeRemove || nodeBeforeRemove === addedNode) {
						nodeBeforeRemove = addedNode.previousSibling;
					}
					if (!nodeAfterRemove || nodeAfterRemove === addedNode) {
						nodeAfterRemove = addedNode.nextSibling;
					}
					addedNode.remove();
				}
			}

			// ...then add the removeds
			if (mutation.removedNodes.length > 0) {
				if (mutation.previousSibling) {
					mutation.previousSibling.after(...mutation.removedNodes);
				} else if (mutation.nextSibling) {
					mutation.nextSibling.before(...mutation.removedNodes);
				} else {
					mutation.target.append(...mutation.removedNodes);
				}
			}

			if (mutation.removedNodes.length > 0) {
				const numRemovedNodes = mutation.removedNodes.length;
				// we added nodes! These should be our selection!
				let foundNodeForSelection = findNodeAndOffset(mutation.removedNodes[0], 0);
				if (foundNodeForSelection && foundNodeForSelection.leafNode) {
					let nodeSelection = nodesAndOffsetsMutatedForSelection.get(foundNodeForSelection.leafNode);
					if (nodeSelection) {
						nodeSelection.start = Math.min(nodeSelection.start, foundNodeForSelection.offset);
					} else {
						nodesAndOffsetsMutatedForSelection.set(foundNodeForSelection.leafNode, {start: foundNodeForSelection.offset, end: foundNodeForSelection.offset});
					}
				}
				foundNodeForSelection = findNodeAndOffset(mutation.removedNodes[numRemovedNodes-1], Infinity);
				if (foundNodeForSelection && foundNodeForSelection.leafNode) {
					nodeSelection = nodesAndOffsetsMutatedForSelection.get(foundNodeForSelection.leafNode);
					if (nodeSelection) {
						nodeSelection.end = Math.max(nodeSelection.end, foundNodeForSelection.offset);
					} else {
						nodesAndOffsetsMutatedForSelection.set(startNodeForSelection.leafNode, {start: foundNodeForSelection.offset, end: foundNodeForSelection.offset});
					}
				}
			} else if (nodeBeforeRemove) {
				let foundNodeForSelection = findNodeAndOffset(nodeBeforeRemove, Infinity);
				let foundNode, foundOffset;
				if (foundNodeForSelection && foundNodeForSelection.leafNode) {
					foundNode = foundNodeForSelection.leafNode;
					foundOffset = foundNodeForSelection.offset;
				} else {
					foundNode = nodeBeforeRemove;
					foundOffset = 0;
				}
				let nodeSelection = nodesAndOffsetsMutatedForSelection.get(foundNode);
				if (nodeSelection) {
					nodeSelection.start = Math.min(nodeSelection.start, foundOffset);
				} else {
					nodesAndOffsetsMutatedForSelection.set(foundNode, {start: foundOffset, end: foundOffset});
				}
			} else if (nodeAfterRemove) {
				let foundNodeForSelection = findNodeAndOffset(nodeAfterRemove, 0);
				let foundNode, foundOffset;
				if (foundNodeForSelection && foundNodeForSelection.leafNode) {
					foundNode = foundNodeForSelection.leafNode;
					foundOffset = foundNodeForSelection.offset;
				} else {
					foundNode = nodeAfterRemove;
					foundOffset = 0;
				}
				let nodeSelection = nodesAndOffsetsMutatedForSelection.get(foundNode);
				if (nodeSelection) {
					nodeSelection.start = Math.min(nodeSelection.start, foundOffset);
				} else {
					nodesAndOffsetsMutatedForSelection.set(foundNode, {start: foundOffset, end: foundOffset});
				}
			}
		} else if (mutation.type === "characterData") {
			wasSubstantial = true;
			// Find first and last difference
			let firstDifferenceIndex;
			const oldString = mutation.target.data;
			const newString = mutation.oldValue;
			const oldLength = oldString.length;
			const newLength = newString.length;
			const minLength = Math.min(oldLength, newLength);
			const maxLength = Math.max(oldLength, newLength);
			for (firstDifferenceIndex = 0; firstDifferenceIndex < minLength; ++firstDifferenceIndex) {
				if (oldString[firstDifferenceIndex] !== newString[firstDifferenceIndex]) {
					break;
				}
			}
			let lastDifferenceIndexFromEnd;
			for (lastDifferenceIndexFromEnd = 0; lastDifferenceIndexFromEnd < minLength; ++lastDifferenceIndexFromEnd) {
				if (oldString[oldLength - 1 - lastDifferenceIndexFromEnd] !== newString[newLength - 1 - lastDifferenceIndexFromEnd]) {
					break;
				}
			}

			// If the string has changed in length, the selection must be at least as big as that change in length, up to the end of the changed string.
			// If we don't do this, common letters between the end of the new string and the old string (eg: the ending 'e' in "Maybe we" and "Maybe")
			// can give us an incorrect selection, and even an end-of-selection before our start-of-selection.
			let lastDifferenceIndex = newLength - lastDifferenceIndexFromEnd;
			{
				const lengthDifference = maxLength - minLength;
				lastDifferenceIndex = Math.min(newLength, Math.max(lastDifferenceIndex, firstDifferenceIndex + lengthDifference));
			}

			mutation.target.data = mutation.oldValue;
			let nodeSelection = nodesAndOffsetsMutatedForSelection.get(mutation.target);
			if (nodeSelection) {
				nodeSelection.start = Math.min(nodeSelection.start, firstDifferenceIndex);
				nodeSelection.end = Math.max(nodeSelection.end, lastDifferenceIndex);
			} else {
				nodesAndOffsetsMutatedForSelection.set(mutation.target, {start: firstDifferenceIndex, end: lastDifferenceIndex});
			}
		} else if (mutation.attributeName) {
			if (mutation.attributeName === "class") {
				wasSubstantial = true;
				if (!nodesAndOffsetsMutatedForSelection.get(mutation.target)) {
					nodesAndOffsetsMutatedForSelection.set(mutation.target, {start: 0, end: 0});
				}
			}
			if (mutation.oldValue) {
				mutation.target.setAttribute(mutation.attributeName, mutation.oldValue);
			} else {
				mutation.target.removeAttribute(mutation.attributeName);
			}
		}
	}

	return wasSubstantial;
}

function getAndPrepCurrentUndoRedoState(putInRedo = false, isSubstantial = true) {
	if (putInRedo) {
		// add to redo stack
		if (needsNewRedo || redoStack.length === 0) {
			const newRedo = new Array();
			redoStack.push(newRedo);
			needsNewRedo = false;
			return newRedo;
		} else {
			const topRedo = redoStack[redoStack.length - 1];
			return topRedo;
		}
	} else {
		// clear redo stack
		if (!doingRedo && isSubstantial) {
			redoStack.length = 0;
		}
		// add to undo stack
		if (needsNewUndo || undoStack.length === 0) {
			const newUndo = new Array();
			undoStack.push(newUndo);
			needsNewUndo = false;
			return newUndo;
		} else {
			const topUndo = undoStack[undoStack.length - 1];
			return topUndo;
		}
	}
}

// Events on changes for undo/redo
const mutationCallback = (mutationList, observer) => {
	// Do any needed processing here

	// Create undo/redo events as needed
	for (const mutation of mutationList) {
		// Get the info
		if (!undoPaused && mutation.type === "childList") {
			getAndPrepCurrentUndoRedoState(doingUndo).push(mutation);
		} else if (mutation.type === "attributes") {
			if (mutation.target === userDoc && mutation.attributeName === "data-undo") {
				// This data attribute dictates writing changes to redo stack instead of undo stack
				if (mutation.oldValue === "undo") {
					doingUndo = false;
					finishUndo();
				} else {
					doingUndo = true;
					finishUndo();
				}
			} else if (mutation.target === userDoc && mutation.attributeName === "data-redo") {
				// This data attribute dictates whether redo stack gets cleared on new changes
				if (mutation.oldValue === "redo") {
					doingRedo = false;
					finishUndo();
				} else {
					doingRedo = true;
					finishUndo();
				}
			} else if (mutation.target === userDoc && mutation.attributeName === "data-undo-paused") {
				// This data attribute dictates whether undo/redo updates do anything at all
				if (mutation.oldValue === "true") {
					undoPaused = false;
				} else {
					undoPaused = true;
				}
			} else if (!undoPaused) {
				if (mutation.attributeName === "data-selected" || mutation.attributeName === "data-selection-child") {
					// skip
				} else {
					getAndPrepCurrentUndoRedoState(doingUndo, mutation.attributeName === "class").push(mutation);
					nodeStatesRecordedForUndo.add(mutation.target);
				}
			}
		} else if (!undoPaused && mutation.type === "characterData") {
			if (!nodeStatesRecordedForUndo.has(mutation.target)) {
				getAndPrepCurrentUndoRedoState(doingUndo).push(mutation);
				nodeStatesRecordedForUndo.add(mutation.target);
			}
		}
	}
};

const mutationObserver = new MutationObserver(mutationCallback);

function startUndoRedoObserver() {
	mutationObserver.observe(userDoc, { attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, childList: true, subtree: true });
}

function stopUndoRedoObserver() {
	mutationObserver.disconnect();
}

function diffWithCachedElements(cachedElements, cachedCopies) {
	let currentNode;
	let startDiffOffset = -1;
	let endDiffOffset = -1;
	const numCachedElements = cachedElements.length;
	let firstDifferenceIndex = 0;
	let firstDifference = null;
	let differenceFound = false;
	let lastDifferenceFound = false;
	let undoDiv = null;
	let firstDifferenceNode = null;
	for (; firstDifferenceIndex < numCachedElements; firstDifferenceIndex++) {
		firstDifference = findFirstDifference(cachedElements[firstDifferenceIndex], cachedCopies[firstDifferenceIndex]);
		if (firstDifference.differenceFound) {
			differenceFound = true;
			firstDifferenceNode = cachedElements[firstDifferenceIndex];
			break;
		}
	}
	if (differenceFound) {
		// find last difference
		let lastDifference = null;
		let lastDifferenceIndex = numCachedElements - 1;
		for (; lastDifferenceIndex >= firstDifferenceIndex; lastDifferenceIndex--) {
			if (lastDifference) {
				if (lastDifferenceIndex !== firstDifferenceIndex) {
					undoDiv.prepend(cachedCopies[lastDifferenceIndex]);
				} else {
					const finalCachedDifference = splitAtOffset(cachedCopies[firstDifferenceIndex], firstDifference.offset);
					undoDiv.prepend(finalCachedDifference);
					return undoDiv;
				}
			} else {
				lastDifference = findLastDifference(cachedElements[lastDifferenceIndex], cachedCopies[lastDifferenceIndex]);
				if (lastDifference.differenceFound) {
					lastDifferenceFound = true;
					undoDiv = document.createElement("div");
					undoDiv.dataset.indexA = cachedStartIndex + firstDifferenceIndex;
					undoDiv.dataset.offsetA = firstDifference.offset;
					undoDiv.dataset.indexB = cachedStartIndex + lastDifferenceIndex;
					undoDiv.dataset.offsetB = lastDifference.offset;
					// split this one:
					const lastCachedSplit = splitAtOffset(cachedCopies[lastDifferenceIndex], lastDifference.offset, false);
					if (lastDifferenceIndex === firstDifferenceIndex) {
						// and split at the beginning, too:
						const finalCachedDifference = splitAtOffset(lastCachedSplit, firstDifference.offset);
						undoDiv.append(finalCachedDifference);
						return undoDiv;
					} else {
						undoDiv.append(lastCachedSplit);
					}
				} else {
					lastDifference = null;
				}
			}
		}
	}

	return null;
}

function doDiffUndoGetRedo(inUndoDiv) {
	const indexA = inUndoDiv.dataset.indexA;
	const offsetA = inUndoDiv.dataset.offsetA;
	const indexB = inUndoDiv.dataset.indexB;
	const offsetB = inUndoDiv.dataset.offsetB;

	if (isNaN(indexA) || isNaN(offsetA) || isNaN(indexB) || isNaN(offsetB)) {
		return null;
	}

	const numChildren = userDoc.children.length;
	if (indexA >= numChildren || indexB >= numChildren) {
		return null;
	}

	// do the diff!
	const redoDiv = document.createElement("div");
	redoDiv.dataset.indexA = indexA;
	redoDiv.dataset.offsetA = offsetA;
	redoDiv.dataset.indexB = indexB;
	redoDiv.dataset.offsetB = offsetB;

	if (indexA === indexB) {
		const firstDifference = splitAtOffset(userDoc.children[indexA], offsetA);
		if (firstDifference) {
			const redoContent = splitAtOffset(firstDifference, offsetB, false);
			if (redoContent) {
				redoDiv.append(redoContent);
			}
			forceMergeElementWith(userDoc.children[indexA], inUndoDiv.firstChild);
			forceMergeElementWith(userDoc.children[indexA], firstDifference);
		} else {
			return null;
		}
	} else {
		const redoContent = splitAtOffset(userDoc.children[indexA], offsetA);
		if (!redoContent) {
			redoDiv.append(redoContent);
		}
		forceMergeElementWith(userDoc.children[indexA], inUndoDiv.firstChild);
		let elementCounter = indexA + 1;
		while (elementCounter < indexB) {
			const replacingElement = userDoc.children[elementCounter];
			if (inUndoDiv.firstChild !== inUndoDiv.lastChild) {
				replacingElement.before(inUndoDiv.firstChild);
				elementCounter++;
			}
			redoDiv.append(replacingElement);
		}
		while (inUndoDiv.firstChild !== inUndoDiv.lastChild) {
			redoDiv.append(userDoc.children[elementCounter]);
		}
		// now we get to the last element of each
		const lastDifference = splitAtOffset(userDoc.children[elementCounter], offsetB, false);
		if (lastDifference) {
			redoDiv.append(lastDifference);
		}
		userDoc.children[elementCounter].before(inUndoDiv.lastChild);
		foreceMergeElementWith(userDoc.children[elementCounter], userDoc.children[elementCounter + 1]);
		redoDiv.dataset.indexB = elementCounter;
	}

	return redoDiv;
}

function getOffsetInParentNode(inParent, inTarget, inOffset) {
	let offsetCounted = 0;
	let childNode = inParent;
	while (childNode) {
		while (childNode.firstChild) {
			childNode = childNode.firstChild;
		}
		if (childNode === inTarget) {
			offsetCounted += inOffset;
			return offsetCounted;
		} else if (childNode.nodeType === Node.TEXT_NODE) {
			offsetCounted += childNode.data.length;
		}
		while (childNode !== inParent && !childNode.nextSibling) {
			childNode = childNode.parentNode;
		}
		if (childNode === inParent) {
			return -1;
		}
		childNode = childNode.nextSibling;
	}
	return offsetCounted;
}

function findNodeAndOffset(inParent, inOffset) {
	let offsetCounted = 0;
	let childNode = inParent;
	let lastTextNode = null;
	if (inOffset === Infinity) {
		// special case -- we're looking for the end
		while (childNode.lastChild) {
			childNode = childNode.lastChild;
		}
		if (childNode.nodeType === Node.TEXT_NODE) {
			lastTextNode = childNode;
			const indexAtEnd = lastTextNode.data.length;
			return {
				leafNode: lastTextNode,
				offset: indexAtEnd,
				charAtOffset: indexAtEnd > 0 ? lastTextNode.data[indexAtEnd - 1] : null,
				overshot: true
			};
		}
		else {
			childNode = inParent;
		}
	}

	while (childNode) {
		while (childNode.firstChild) {
			childNode = childNode.firstChild;
		}
		if (childNode.nodeType === Node.TEXT_NODE) {
			lastTextNode = childNode;
			offsetCounted += childNode.data.length;
			if (offsetCounted >= inOffset) {
				const indexAtOffset = childNode.data.length - (offsetCounted - inOffset);
				return {
					leafNode: childNode,
					offset: indexAtOffset,
					chartAtOffset: indexAtOffset >= 0 ? childNode.data[indexAtOffset - 1] : null
				};
			}
		}
		while (childNode !== inParent && !childNode.nextSibling) {
			childNode = childNode.parentNode;
		}
		if (childNode === inParent) {
			break;
		}
		childNode = childNode.nextSibling;
	}
	// went past end, but still useful to have last text node if there was one:
	if (lastTextNode) {
		const indexAtEnd = lastTextNode.data.length;
		return {
			leafNode: lastTextNode,
			offset: indexAtEnd,
			charAtOffset: indexAtEnd > 0 ? lastTextNode.data[indexAtEnd - 1] : null,
			overshot: true
		};
	}

	return null;
}

function splitAtOffset(inParent, inOffset, fromStart = true) {
	let offsetCounted = 0;
	let childNode = fromStart ? inParent.firstChild : inParent.lastChild;
	while (childNode && childNode != inParent) {
		if (fromStart) {
			while (childNode.firstChild) {
				childNode = childNode.firstChild;
			}
		} else {
			while (childNode.lastChild) {
				childNode = childNode.lastChild;
			}
		}
		if (childNode.nodeType === Node.TEXT_NODE) {
			lastTextNode = childNode;
			offsetCounted += childNode.data.length;
			if (offsetCounted >= inOffset) {
				const indexAtOffset = fromStart ? childNode.data.length - (offsetCounted - inOffset) : offsetCounted - inOffset;
				// Copy this one so we can split it
				const beforeText = childNode.data.slice(0, indexAtOffset);
				const afterText = childNode.data.slice(indexAtOffset);
				let nodeCopy = null;
				if (fromStart) {
					if (afterText.length) {
						nodeCopy = childNode.cloneNode(true);
						nodeCopy.data = afterText;
					}
					childNode.data = beforeText;
				} else {
					if (beforeText.length) {
						nodeCopy = childNode.cloneNode(true);
						nodeCopy.data = beforeText;
					}
					childNode.data = afterText;
				}
				let copyChild = childNode;
				let copyParent = childNode.parentNode;
				let parentCopy = null;
				let childEmptied = childNode.data.length === 0;
				let parentEmptied = childEmptied;
				while (copyParent && copyChild && !isOrderableElement(copyChild)) {
					parentCopy = copyParent.cloneNode(false);
					let splitIndex = 0;
					let childNodeWalker = copyParent.firstChild;
					if (fromStart) {
						while (childNodeWalker && childNodeWalker !== copyChild) {
							splitIndex++;
							childNodeWalker = childNodeWalker.nextSibling;
							parentEmptied = false;
						}
						if (nodeCopy) {
							parentCopy.append(nodeCopy);
						}
						while (copyParent.childNodes.length > splitIndex + 1) {
							const movingNode = copyParent.childNodes[splitIndex + 1];
							parentCopy.append(movingNode);
						}
					} else {
						while (childNodeWalker && childNodeWalker !== copyChild) {
							const movingNode = copyParent.firstChild;
							parentCopy.append(movingNode);
							childNodeWalker = copyParent.firstChild;
						}
						if (copyParent.firstChild) {
							parentEmptied = false;
						}
						if (nodeCopy) {
							parentCopy.append(nodeCopy);
						}
					}
					if (childEmptied) {
						copyChild.remove();
						if (parentEmptied) {
							if (isOrderableElement(copyParent)) {
								// We don't remove empty orderables.
								copyParent.appendChild(document.createElement("br"));
								return parentCopy;
							} else {
								// Remove this node on the next loop
								childEmptied = true;
							}
						} else {
							childEmptied = false;
						}
					}
					copyChild = copyParent;
					nodeCopy = parentCopy;
					copyParent = copyParent.parentNode;
				}

				return parentCopy;
			}
		}
		if (fromStart) {
			while (childNode !== inParent && !childNode.nextSibling) {
				childNode = childNode.parentNode;
			}
		} else {
			while (childNode !== inParent && !childNode.previousSibling) {
				childNode = childNode.parentNode;
			}
		}
		if (childNode === inParent) {
			break;
		}
		childNode = fromStart ? childNode.nextSibling : childNode.previousSibling;
	}

	// went past end, didn't create anything new
	return null;
}

function mergeElementWith(inNode, inAfter) {
	if (inNode.nodeType === inAfter.nodeType && inNode.nodeName === inAfter.nodeName) {
		if (inNode.nodeType === Node.TEXT_NODE) {
			// TODO: should be a faster way to only convert the beginning spaces
			inNode.data = inNode.data + inAfter.data.replace("\u00A0", " ");
		} else {
			const lastBefore = inNode.lastChild;
			const firstAfter = inAfter.firstChild;
			inNode.append(...inAfter.childNodes);
			if (lastBefore && firstAfter) {
				mergeElementWith(lastBefore, firstAfter);
			}
		}
	}
}

function forceMergeElementWith(inNode, inAfter) {
	if (inNode.nodeType !== inAfter.nodeType) {
		if (inNode.nodeType === Node.TEXT_NODE) {
			if (inAfter.firstChild) {
				forceMergeElementWith(inNode, inAfter.firstChild);
			}
		} else {
			if (inNode.firstChild) {
				forceMergeElementWith(inNode.firstChild, inAfter);
			}
		}
	} else if (inNode.nodeType !== Node.TEXT_NODE) {
		const lastBefore = inNode.lastChild;
		const firstAfter = inAfter.firstChild;
		inNode.append(...inAfter.childNodes);
		if (lastBefore && firstAfter) {
			mergeElementWith(lastBefore, firstAfter);
		}
	} else {
		inNode.data = inNode.data + inAfter.data.replace("\u00A0", " ");
	}
}

function findFirstDifference(aNode, bNode, inOffset = 0) {
	let offsetCounted = inOffset;
	if (aNode.nodeType === bNode.nodeType && aNode.nodeName === bNode.nodeName) {
		if (aNode.nodeType === Node.TEXT_NODE) {
			let i = 0;
			const aData = aNode.data;
			const bData = bNode.data;
			const differentLengths = aData.length !== bData.length;
			const dataLength = Math.min(aData.length, bData.length);
			for (; i < dataLength; i++) {
				if (aData[i] !== bData[i]) {
					return {
						differenceFound: true,
						offset: offsetCounted + i
					};
				}
			}

			const aHasSibling = aNode.nextSibling !== null;
			const bHasSibling = bNode.nextSibling !== null;

			if (differentLengths || aHasSibling !== bHasSibling) {
				return {
					differenceFound: true,
					offset: offsetCounted + dataLength
				};
			}

			if (aHasSibling) {
				return findFirstDifference(aNode.nextSibling, bNode.nextSibling, offsetCounted + dataLength);
			}
		} else {
			let aSibling = aNode.firstChild;
			let bSibling = bNode.firstChild;
			while (aSibling && bSibling && aSibling.nodeType === bSibling.nodeType && aSibling.nodeName === bSibling.nodeName) {
				const firstDifference = findFirstDifference(aSibling, bSibling, offsetCounted);
				if (firstDifference.differenceFound) {
					return firstDifference;
				}
				offsetCounted = firstDifference.offset;

				aSibling = aSibling.nextSibling;
				bSibling = bSibling.nextSibling;

				if ((aSibling && !bSibling) || (bSibling && !aSibling)) {
					return {
						differenceFound: true,
						offset: offsetCounted
					};
				}
			}

			return {
				differenceFound: false,
				offset: offsetCounted
			};
		}
	} else {
		return {
			differenceFound: true,
			offset: offsetCounted
		};
	}
	return {
		differenceFound: false,
		offset: offsetCounted
	};
}

function findLastDifference(aNode, bNode, inOffset = 0) {
	// as above but from the end
	let offsetCounted = inOffset;
	if (aNode.nodeType === bNode.nodeType && aNode.nodeName === bNode.nodeName) {
		if (aNode.nodeType === Node.TEXT_NODE) {
			let i = 0;
			const aData = aNode.data;
			const bData = bNode.data;
			const aLength = aData.length;
			const bLength = bData.length;
			const differentLengths = aLength !== bLength;
			const dataLength = Math.min(aLength, bLength);
			for (; i < dataLength; i++) {
				if (aData[aLength - 1 - i] !== bData[bLength - 1 - i]) {
					return {
						differenceFound: true,
						offset: offsetCounted + i
					};
				}
			}

			const aHasSibling = aNode.previousSibling !== null;
			const bHasSibling = bNode.previousSibling !== null;

			if (differentLengths || aHasSibling !== bHasSibling) {
				return {
					differenceFound: true,
					offset: offsetCounted + dataLength
				};
			}

			if (aHasSibling) {
				return findLastDifference(aNode.previousSibling, bNode.previousSibling, offsetCounted + dataLength);
			}
		} else {
			let aSibling = aNode.lastChild;
			let bSibling = bNode.lastChild;
			while (aSibling && bSibling && aSibling.nodeType === bSibling.nodeType && aSibling.nodeName === bSibling.nodeName) {
				const lastDifference = findLastDifference(aSibling, bSibling, offsetCounted);
				if (lastDifference.differenceFound) {
					return lastDifference;
				}
				offsetCounted = lastDifference.offset;

				aSibling = aSibling.previousSibling;
				bSibling = bSibling.previousSibling;

				if ((aSibling && !bSibling) || (bSibling && !aSibling)) {
					return {
						differenceFound: true,
						offset: offsetCounted
					};
				}
			}

			return {
				differenceFound: false,
				offset: offsetCounted
			};
		}
	} else {
		return {
			differenceFound: true,
			offset: offsetCounted
		};
	}
	return {
		differenceFound: false,
		offset: offsetCounted
	};
}

function copySelectedContent() {
	// no selection
	if (currentSelection.endNode === currentSelection.startNode && currentSelection.endOffset <= currentSelection.startOffset) {
		return null;
	}

	// otherwise, array of nodes, split as appropriate
	let copiedNodes = Array();
	let targetCopy = null;
	let result = copiedNodes;
	let splitFirst = false;
	if (currentSelection.startOffset !== 0) {
		// We need to split the first node
		if (currentSelection.startNode.nodeType === Node.TEXT_NODE) {
			// Split it!
			const textData = currentSelection.startNode.data;
			if (currentSelection.startOffset < textData.length) {
				// There's more -- what if it's also the last node?
				if (currentSelection.endNode === currentSelection.startNode && currentSelection.endOffset < textData.length) {
					const splitStart = document.createTextNode(textData.slice(currentSelection.startOffset, currentSelection.endOffset));
					copiedNodes.push(splitStart);
					return copiedNodes;
				} else {
					targetCopy = document.createTextNode(textData.slice(currentSelection.startOffset));
					copiedNodes.push(targetCopy);
					splitFirst = true;
				}
			}
		}
	}
	if (!splitFirst) {
		targetCopy = currentSelection.startNode.cloneNode(true);
		copiedNodes.push(targetCopy);
	}

	// POSSIBILITIES I NEED TO CONSIDER:
	// end node is deeper than start node (eg: end node is in <strong> element)
	// start node is deeper than end node (eg: start node is in <strong> element)
	// BUUUUUUT anything deeper than GetOrderableParent() is a node we want to keep, anyway, because it has formatting info. SO...
	// whatever we're doing, we want to get to the OrderableParent level.
	// Like, what if we have something like GetAfterSplit which IS the OrderableParent as if split after startNode and offset...
	// and we GetBeforeSplit, which IS the OrderableParent as if split before endNode and offset...
	// No, what if we copy all selected OrderableParents (DEEP), but on the end, shave off using the offset, and on the start, clip using the offset.

	// keep pushing clones until we get to the last node in the selection
	let targetNode = currentSelection.startNode;
	while (targetNode && targetNode !== currentSelection.endNode) {
		while (targetNode.firstChild && targetNode !== currentSelection.endNode) {
			targetNode = targetNode.firstChild;
			const shallowCopy = targetNode.cloneNode();
			targetCopy.appendChild(shallowCopy);
			targetCopy = shallowCopy;
		}
		if (targetNode === currentSelection.endNode) {
			// might need splitting...
			break;
		}
		while (targetNode !== currentSelection.endNode && !targetNode.nextSibling) {
			targetNode = targetNode.parentNode;
			if (targetCopy.parentNode) {
				targetCopy = targetCopy.parentNode;
			}
		}
		if (targetNode === currentSelection.endNode) {
			break;
		}
		targetNode = targetNode.nextSibling;
		
	}
	return result;
}

function deleteSelectedContent() {
	// no selection
	if (currentSelection.endNode === currentSelection.startNode && currentSelection.endOffset <= currentSelection.startOffset) {
		return;
	}

	// otherwise, array of nodes, split as appropriate
	const nodesToRemove = Array();
	let splitFirst = false;
	if (currentSelection.startOffset !== 0) {
		// We need to split the first node
		if (currentSelection.startNode.nodeType === Node.TEXT_NODE) {
			// Split it!
			const textData = currentSelection.startNode.data;
			if (currentSelection.startOffset < textData.length) {
				// There's more -- what if it's also the last node?
				if (currentSelection.endNode === currentSelection.startNode && currentSelection.endOffset < textData.length) {
					currentSelection.startNode.data = textData.slice(0, currentSelection.startOffset - 1) + textData.slice(currentSelection.endOffset);
					return;
				} else {
					currentSelection.startNode.data = textData.slice(0, currentSelection.startOffset - 1);
					splitFirst = true;
				}
			}
		}
	}
	if (!splitFirst) {
		nodesToRemove.push(currentSelection.startNode);
	}
	// keep deleting until we get to the last node in the selection
}

function doUndo() {
	if (undoStack.length > 0) {
		userDoc.dataset.undo = "undo";
		clearParagraphHighlights();
		nodesAndOffsetsMutatedForSelection.clear();
		let latestUndo = undoStack.pop();
		while (!undoMutations(latestUndo)) {
			if (undoStack.length > 0) {
				latestUndo = undoStack.pop();
			} else {
				break;
			}
		}
		setSelectionFromMutatedNodes();
		delete userDoc.dataset.undo;
		return true;
	}
	return false;
}

function doRedo() {
	if (redoStack.length > 0) {
		userDoc.dataset.redo = "redo";
		clearParagraphHighlights();
		nodesAndOffsetsMutatedForSelection.clear();
		getAndPrepCurrentUndoRedoState(false, false);
		let latestRedo = redoStack.pop();
		while (!undoMutations(latestRedo)) {
			if (redoStack.length > 0) {
				latestRedo = redoStack.pop();
			} else {
				break;
			}
		}
		setSelectionFromMutatedNodes();
		delete userDoc.dataset.redo;
		return true;
	}
	return false;
}

function clearRedo() {
	redoStack.length = 0;
}

function copyDataFromTo(fromNode, toNode) {
	let movingData = fromNode.dataset.level;
	if (movingData) {
		toNode.dataset.level = movingData;
	} else {
		delete toNode.dataset.level;
	}
	movingData = fromNode.dataset.nodeWords;
	if (movingData) {
		toNode.dataset.nodeWords = movingData;
	} else {
		delete toNode.dataset.nodeWords;
	}
}

function calculateMissingData(inNode) {
	if (!inNode.dataset.level) {
		inNode.dataset.level = calculateLevelForData(inNode);
	}
	if (!inNode.dataset.countNodeWords) {
		inNode.dataset.nodeWords = countNodeWords(inNode);
	}
}

function getNodeLevel(inNode) {
	let nodeLevel = +inNode.dataset.level;
	if (isNaN(nodeLevel)) {
		return null;
	}
	return nodeLevel;
}

function getOrCalculateNodeLevel(inNode) {
	if (!inNode.dataset) {
		return pLevel;
	}
	let nodeLevel = +inNode.dataset.level;
	if (isNaN(nodeLevel)) {
		nodeLevel = calculateLevelForData(inNode);
		inNode.dataset.level = nodeLevel;
	}
	return nodeLevel;
}

function setNodeLevel(inNode, inLevel) {
	inNode.dataset.level = inLevel;
}

function getNodeWordCount(inNode) {
	let nodeWords = +inNode.dataset.nodeWords;
	if (isNaN(nodeWords)) {
		return null;
	}
	return nodeWords;
}

function getOrCalculateNodeWordCount(inNode) {
	let nodeWords = +inNode.dataset.nodeWords;
	if (isNaN(nodeWords)) {
		nodeWords = countNodeWords(inNode);
		inNode.dataset.nodeWords = nodeWords;
	}
	return nodeWords;
}

function calculateAndSetNodeWordCount(inNode) {
	let nodeWords = +inNode.dataset.nodeWords;
	if (isNaN(nodeWords)) {
		nodeWords = countNodeWords(inNode);
		inNode.dataset.nodeWords = nodeWords;
		return {
			hadValidData: false,
			deltaWords: nodeWords
		};
	}
	const newNodeWords = countNodeWords(inNode);
	if (nodeWords === newNodeWords) {
		return {
			hadValidData: true,
			deltaWords: 0
		};
	} else {
		inNode.dataset.nodeWords = newNodeWords;
		return {
			hadValidData: true,
			deltaWords: newNodeWords - nodeWords
		};
	}
}

function setNodeWordCount(inNode, inWordCount) {
	inNode.dataset.nodeWords = inWordCount;
}

function getNodeChildWordCount(inNode) {
	let nodeChildWords = +inNode.dataset.childWords;
	if (isNaN(nodeChildWords)) {
		return null;
	}
	return nodeChildWords;
}

function setNodeChildWordCount(inNode, inWordCount, isHeading = true) {
	inNode.dataset.childWords = inWordCount;
	if (isHeading) {
		if (inWordCount) {
			if (inWordCount === 1) {
				inNode.dataset.wordDisplay = "(1 word)";
			} else {
				inNode.dataset.wordDisplay = "(" + inWordCount + " words)";
			}
		} else {
			delete inNode.dataset.wordDisplay;
		}
	}
}

function clearNodeWordCounters(inNode) {
	delete inNode.dataset.nodeWords;
	delete inNode.dataset.childWords;
	delete inNode.dataset.wordDisplay;
}

let arrowLeftPressed = false;
let arrowUpPressed = false;
let arrowRightPressed = false;
let arrowDownPressed = false;
let shiftPressed = false;
let altPressed = false;

function isDocElement(element) {
	return (element && element.parentNode && element.parentNode.id === "userDoc");
}

function isTOCElement(element) {
	return (element && element.parentNode && element.parentNode.id === "tableOfContents");
}

function isOrderableElement(element) {
	return isDocElement(element) || isTOCElement(element);
}

function getOrderableParent(element) {
	let checkingNode = element;
	while (checkingNode) {
		if (isOrderableElement(checkingNode)) {
			return checkingNode;
		}
		checkingNode = checkingNode.parentNode;
	}
	return null;
}

// Usage: for (let inNode of allUserElements())
function* allUserElements() {
	let targetNode = userDoc.firstChild;
	while (targetNode) {
		const nextNode = targetNode.nextSibling;
		if (targetNode.classList)
		{
			yield targetNode;
		}
		targetNode = nextNode;
	}
}

// Usage: for (let targetNode of childNodesOf(inNode))
function* childNodesOf(inNode) {
	let inLevel = getOrCalculateNodeLevel(inNode);
	let currentNode = inNode.nextSibling;
	while (currentNode) {
		const nextNode = currentNode.nextSibling;
		if (currentNode.classList) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel <= inLevel) {
				return;
			}
		}
		yield currentNode;
		currentNode = nextNode;
	}
}

// Usage: for (let targetNode of childElementsOf(inNode))
function* childElementsOf(inNode) {
	let inLevel = getOrCalculateNodeLevel(inNode);
	let currentNode = inNode.nextSibling;
	while (currentNode) {
		const nextNode = currentNode.nextSibling;
		if (currentNode.classList) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel <= inLevel) {
				return;
			}
			yield currentNode;
		}
		currentNode = nextNode;
	}
}

// Usage: for (let targetNode of childVisibleElementsOf(inNode))
function* childVisibleElementsOf(inNode) {
	let inLevel = getOrCalculateNodeLevel(inNode);
	let currentNode = inNode.nextSibling;
	while (currentNode) {
		const nextNode = currentNode.nextSibling;
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel <= inLevel) {
				return;
			}
			yield currentNode;
		}
		currentNode = nextNode;
	}
}

// Usage: for (let targetNode of childFullyVisibleElementsOf(inNode))
function* childFullyVisibleElementsOf(inNode) {
	let inLevel = getOrCalculateNodeLevel(inNode);
	let currentNode = inNode.nextSibling;
	while (currentNode) {
		const nextNode = currentNode.nextSibling;
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent") && !currentNode.classList.contains("hidden")) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel <= inLevel) {
				return;
			}
			yield currentNode;
		}
		currentNode = nextNode;
	}
}

// Usage: for (let inNode of selectedNodes())
function* selectedNodes() {
	let targetNode = currentSelection.startElement;
	let isLast = false;
	while (!isLast && targetNode) {
		const nextNode = targetNode.nextSibling;
		isLast = targetNode === currentSelection.endElement || !nextNode;
		yield targetNode;
		targetNode = nextNode;
	}
}

// Usage: for (let inNode of selectedElements())
function* selectedElements() {
	let targetNode = currentSelection.startElement;
	let isLast = false;
	while (!isLast && targetNode) {
		const nextNode = targetNode.nextSibling;
		isLast = targetNode === currentSelection.endElement || !nextNode;
		if (targetNode.classList)
		{
			yield targetNode;
		}
		targetNode = nextNode;
	}
}

// Usage: for (let inNode of selectedVisibleElements())
function* selectedVisibleElements() {
	let targetNode = currentSelection.startElement;
	let isLast = false;
	while (!isLast && targetNode) {
		const nextNode = targetNode.nextSibling;
		isLast = targetNode === currentSelection.endElement || !nextNode;
		if (targetNode.classList && !targetNode.classList.contains("hiddenParent") && !targetNode.classList.contains("hiddenLevel"))
		{
			yield targetNode;
		}
		targetNode = nextNode;
	}
}

// Usage: for (let inNode of selectedFullyVisibleElements())
function* selectedFullyVisibleElements() {
	let targetNode = currentSelection.startElement;
	let isLast = false;
	while (!isLast && targetNode) {
		const nextNode = targetNode.nextSibling;
		isLast = targetNode === currentSelection.endElement || !nextNode;
		if (targetNode.classList && !targetNode.classList.contains("hidden") && !targetNode.classList.contains("hiddenParent") && !targetNode.classList.contains("hiddenLevel"))
		{
			yield targetNode;
		}
		targetNode = nextNode;
	}
}

// Usage: for (let inNode of selectedNodesReversed())
function* selectedNodesReversed() {
	let targetNode = currentSelection.endElement;
	let isFirst = false;
	while (!isFirst && targetNode) {
		const prevNode = targetNode.previousSibling;
		isFirst = targetNode === currentSelection.startElement || !prevNode;
		yield targetNode;
		targetNode = prevNode;
	}
}

// Usage: for (let inNode of selectedElementsReversed())
function* selectedElementsReversed() {
	let targetNode = currentSelection.endElement;
	let isFirst = false;
	while (!isFirst && targetNode) {
		const prevNode = targetNode.previousSibling;
		isFirst = targetNode === currentSelection.startElement || !prevNode;
		if (targetNode.classList)
		{
			yield targetNode;
		}
		targetNode = prevNode;
	}
}

// Usage: for (let inNode of selectedVisibleElementsReversed())
function* selectedVisibleElementsReversed() {
	let targetNode = currentSelection.endElement;
	let isFirst = false;
	while (!isFirst && targetNode) {
		const prevNode = targetNode.previousSibling;
		isFirst = targetNode === currentSelection.startElement || !prevNode;
		if (targetNode.classList && !targetNode.classList.contains("hiddenParent") && !targetNode.classList.contains("hiddenLevel"))
		{
			yield targetNode;
		}
		targetNode = prevNode;
	}
}

// Usage: for (let inNode of selectedFullyVisibleElementsReversed())
function* selectedFullyVisibleElementsReversed() {
	let targetNode = currentSelection.endElement;
	let isFirst = false;
	while (!isFirst && targetNode) {
		const prevNode = targetNode.previousSibling;
		isFirst = targetNode === currentSelection.startElement || !prevNode;
		if (targetNode.classList && !targetNode.classList.contains("hidden") && !targetNode.classList.contains("hiddenParent") && !targetNode.classList.contains("hiddenLevel"))
		{
			yield targetNode;
		}
		targetNode = prevNode;
	}
}

function countNodeWords(targetNode) {
	let currentWords = 0;
	if (targetNode) {
		if (targetNode.nodeType === Node.TEXT_NODE) {
			// count the words!
			const contents = targetNode.data;
			let wordFound = false;
			for (const character of contents) {
				if (/\s/.test(character)) {
					wordFound = false;
        			} else if (!wordFound) {
					wordFound = true;
					currentWords++;
				}
			}
		} else {
			// look for words in children
			let targetChild = targetNode.firstChild;
			while (targetChild) {
				currentWords += countNodeWords(targetChild);
				targetChild = targetChild.nextSibling;
			}
		}
	}
	return currentWords;
}

function updateParentNodeChildWords(inNode, delta, stopAtHiddenParent = false) {
	let levelHandled = getOrCalculateNodeLevel(inNode);
	let currentNode = inNode.previousSibling;
	while (currentNode) {
		currentNode = getOrderableParent(currentNode);
		if (!currentNode) {
			break;
		}
		if (currentNode.nodeType === Node.TEXT_NODE) {
			// for now, skip these
			currentNode = currentNode.previousSibling;
			continue;
		}

		const thisNodeLevel = getOrCalculateNodeLevel(currentNode);
		if (thisNodeLevel < levelHandled) {
			// got a parent!
			let childWords = getNodeChildWordCount(currentNode);
			if (isNaN(childWords)) {
				// oh, invalid node! recalculate!
				countChildWords();
				return false;
			}

			setNodeChildWordCount(currentNode, childWords + delta, thisNodeLevel < pLevel);
			if (stopAtHiddenParent && currentNode.classList.contains("hidden")) {
				return true;
			}
			levelHandled = thisNodeLevel;
		}

		currentNode = currentNode.previousSibling;
	}

	return true;
}

function countChildWords() {
	const childCountsForLevels = Array();
	let currentChild = userDoc.lastChild;
	while (currentChild) {
		currentChild = getOrderableParent(currentChild);
		if (!currentChild) {
			break;
		}

		if (currentChild.nodeType === Node.TEXT_NODE) {
			// for now, skip these
			currentChild = currentChild.previousSibling;
			continue;
		}

		const thisNodeLevel = getOrCalculateNodeLevel(currentChild);

		let numWords = 0;
		if (thisNodeLevel >= pLevel) {
			// count 'em!
			numWords = getOrCalculateNodeWordCount(currentChild);
		}

		// gather up child numbers and remove from childCountsForLevels array
		const justChildren = childCountsForLevels.splice(thisNodeLevel+1, Infinity);
		let numCountedForThisLevel = 0;
		justChildren.forEach((count) => numCountedForThisLevel += count);

		setNodeChildWordCount(currentChild, numCountedForThisLevel, thisNodeLevel < pLevel);

		numCountedForThisLevel += numWords;
		if (currentChild.classList && currentChild.classList.contains("hidden")) {
			// do not pass on child node counts to parents -- just leave them
		} else if (childCountsForLevels[thisNodeLevel]) {
			childCountsForLevels[thisNodeLevel] += numCountedForThisLevel;
		} else {
			childCountsForLevels[thisNodeLevel] = numCountedForThisLevel;
		}

		currentChild = currentChild.previousSibling;
	}
}

// assumes isOrderableElement(inNode)
function addClassToChildren(inNode, inClass) {
	let currentNode = null;
	for (currentNode of childElementsOf(inNode)) {
		currentNode.classList.add(inClass);
	}
}

// assumes isOrderableElement(inNode)
function removeClassFromChildrenExceptChildrenOf(inNode, inClass, exceptClass) {
	const inNodeLevel = getOrCalculateNodeLevel(inNode);
	const exceptLevels = Array();
	let currentNode = null;
	for (currentNode of childElementsOf(inNode)) {
		const currentNodeLevel = getOrCalculateNodeLevel(currentNode);
		if (currentNodeLevel <= inNodeLevel) {
			break;
		}
		exceptLevels.splice(currentNodeLevel, Infinity);
		if (!exceptLevels.some((x) => x)) {
			// we've not seen an exceptClass that's a parent of this node
			currentNode.classList.remove(inClass);
		}
		if (currentNode.classList.contains(exceptClass)) {
			exceptLevels[currentNodeLevel] = true;
		}
	}
}

// assumes isOrderableElement(inNode)
function removeClassFromChildren(inNode, inClass) {
	let currentNode = null;
	for (currentNode of childElementsOf(inNode)) {
		currentNode.classList.remove(inClass);
	}
}

function hideNode(inNode) {
	let targetNode = getOrderableParent(inNode);
	if (targetNode && targetNode.classList) {
		targetNode.classList.add("hidden");
		addClassToChildren(targetNode, "hiddenParent");
	}
}

function unhideNode(inNode) {
	let targetNode = getOrderableParent(inNode);
	if (targetNode && targetNode.classList) {
		targetNode.classList.remove("hidden");
		removeClassFromChildrenExceptChildrenOf(targetNode, "hiddenParent", "hidden");
	}
}

// returns true if we need a recount
function toggleHidden(inNode) {
	let needsRecount = false;
	let targetNode = getOrderableParent(inNode);
	if (targetNode && targetNode.classList) {
		let childWordCount = getNodeChildWordCount(targetNode);
		const targetNodeLevel = getOrCalculateNodeLevel(targetNode);
		if (targetNodeLevel >= pLevel) {
			// its own words count, too
			childWordCount += getOrCalculateNodeWordCount(targetNode);
		}
		const isHidden = targetNode.classList.contains("hidden");
		if (isHidden) {
			unhideNode(targetNode);
		} else {
			hideNode(targetNode);
		}

		if (isNaN(childWordCount)) {
			needsRecount = true;
		} else if (isHidden) {
			updateParentNodeChildWords(targetNode, childWordCount, targetNode.classList.contains("hiddenParent"));
		} else {
			updateParentNodeChildWords(targetNode, -childWordCount, targetNode.classList.contains("hiddenParent"));
		}
	}
	return needsRecount;
}

function unnestNodes(startNode) {
	let targetNode = startNode;
	if (targetNode.childNodes) {
		const childrenCopy = Array.from(targetNode.childNodes);
		for (const childNode of childrenCopy) {
			unnestNodes(childNode);
		}
	}

	const nodesToMove = Array();

	// childNodes may have changed
	if (targetNode.childNodes) {
		let pulledAnyOut = false;
		for (const childNode of targetNode.childNodes) {
			if (pulledAnyOut || !nestableSet.has(childNode.nodeName)) {
				// pull it out!
				nodesToMove.push(childNode);
				pulledAnyOut = true; // once one is pulled out, we have to do the rest to maintain order
			}
		}

		let numPulledNodes = nodesToMove.length;
		for (let i = 0; i < numPulledNodes; i++) {
			let pulledNode = nodesToMove[i];
			if (pulledNode) {
				if (!pulledNode.nodeName || !orderableSet.has(pulledNode.nodeName)) {
					// create new node to put this node in
					const newElement = document.createElement("p");
					newElement.append(pulledNode);
					nodesToMove[i] = newElement;
				}
			}
		}

		// finally, push the nodes!
		if (nodesToMove && nodesToMove.length > 0) {
			targetNode.after(...nodesToMove);
		}
	}

	return nodesToMove.length;
}

function setListLevel(inNode, inLevel) {
	const sanitizedLevel = Math.min(+inLevel, maxIndentLevel);
	const previousSanitizedLevel = getOrCalculateNodeLevel(inNode) - pLevel;
	if (sanitizedLevel && sanitizedLevel > 0) {
		inNode.classList.add("userListItem");
		const newLevel = pLevel + sanitizedLevel;
		if (sanitizedLevel % 2 === 0) {
			inNode.classList.add("evenListLevel");
		} else {
			inNode.classList.remove("evenListLevel");
		}
		setNodeLevel(inNode, newLevel);
		if (previousSanitizedLevel <= 0) {
			inNode.classList.remove("altA");
			inNode.classList.remove("altB");
		}
	} else {
		setNodeLevel(inNode, pLevel);
		inNode.classList.remove("userListItem");
		inNode.classList.remove("evenListLevel");
		if (previousSanitizedLevel > 0) {
			inNode.classList.remove("altA");
			inNode.classList.remove("altB");
		}
	}
	return sanitizedLevel;
}

function sanitizeNodes(startNode, numNodes) {
	let targetNode = startNode;
	let numProcessedNodes = 0;
	let numWords = 0;
	let hasTopLevelNodes = false;
	while (targetNode && numProcessedNodes < numNodes) {
		// first get next node, because sanitizing might insert new nodes in-between
		// if it pulls up nested children, but we don't want to process them again:
		const nextNode = targetNode.nextSibling;
		let thisHasTopLevelNodes = false;

		// sanitize children:
		let targetNodeWords = 0;
		if (targetNode.firstChild) {
			const sanitizeResult = sanitizeNodes(targetNode.firstChild, targetNode.childNodes.length);
			targetNodeWords += sanitizeResult.numWords;
			thisHasTopLevelNodes = hasTopLevelNodes || sanitizeResult.hasTopLevelNodes;
		} else {
			targetNodeWords += countNodeWords(targetNode);
		}

		numWords += targetNodeWords;
		const isEmpty = targetNodeWords === 0;
		const currentNodeName = targetNode.nodeName;
		const newNodeName = sanitizeMap.get(currentNodeName);
		//const pullOutChildren = thisHasTopLevelNodes || newNodeName === ".";
		hasTopLevelNodes = hasTopLevelNodes || thisHasTopLevelNodes ||
			orderableSet.has(currentNodeName) || orderableSet.has(newNodeName);
		if (isEmpty || newNodeName === "-") {
			targetNode.remove();
		} else if (newNodeName === ".") {
			// pull children out
			targetNode.after(...targetNode.childNodes);
			targetNode.remove();
		} else if (newNodeName) {
			const newElement = document.createElement(newNodeName);
			targetNode.after(newElement);
			newElement.append(...targetNode.childNodes);
			copyDataFromTo(targetNode, newElement);
			const targetAriaLevel = +targetNode.ariaLevel;
			targetNode.remove();
			setNodeWordCount(newElement, targetNodeWords);
			let newLevel = nodeNameToLevel.get(newElement.nodeName);
			// special case -- convert bullets
			if (newLevel === pLevel && currentNodeName === "LI") {
				if (targetAriaLevel && targetAriaLevel > 0) {
					setListLevel(newElement, targetAriaLevel);
				} else {
					setListLevel(newElement, 1);
				}
			} else if (!isNaN(newLevel)) {
				setNodeLevel(newElement, newLevel);
			}
		} else {
			if (targetNode.nodeType === Node.ELEMENT_NODE) {
				targetNode.removeAttribute("style");
				setNodeWordCount(targetNode, targetNodeWords);
			}
			if (targetNode.classList) {
				delete targetNode.dataset.selected;
			}
		}

		targetNode = nextNode;
		numProcessedNodes++;
	}
	return {
		numWords: numWords,
		hasTopLevelNodes: hasTopLevelNodes
	};
}

function convertNodeToType(targetNode, newNodeName) {
	if (targetNode && targetNode.classList) {
		if (newNodeName) {
			// are we allowed to go to this level?
			const newLevel = nodeNameToLevel.get(newNodeName);
			if (showingLevel < maxShowingLevel && showingLevel < newLevel) {
				return false;
			}
			const newElement = document.createElement(newNodeName);
			targetNode.after(newElement);
			newElement.append(...targetNode.childNodes);
			copyDataFromTo(targetNode, newElement);
			targetNode.remove();
			if (!isNaN(newLevel)) {
				setNodeLevel(newElement, newLevel);
			}
			if (targetNode === currentSelection.startElement) {
				// Fix lost selection
				currentSelection.startElement = newElement;
				if (targetNode === currentSelection.startNode) {
					currentSelection.startNode = newElement;
				}
			}
			if (targetNode === currentSelection.endElement) {
				// Fix lost selection
				currentSelection.endElement = newElement;
				if (targetNode === currentSelection.endNode) {
					currentSelection.endNode = newElement;
				}
			}
			return true;
		}
	}
	return false;
}

function convertNodeByMap(inputMap, targetNode) {
	if (targetNode && targetNode.classList) {
		const currentNodeName = targetNode.nodeName;
		const newNodeName = inputMap.get(currentNodeName);
		if (newNodeName) {
			convertNodeToType(targetNode, newNodeName);
			return true;
		}
	}
	return false;
}

// requires selection to be set correctly beforehand
function convertSelectedNodesByMap(inputMap) {
	let targetNode;
	for (targetNode of selectedFullyVisibleElements()) {
		convertNodeByMap(inputMap, targetNode);
	}
	restoreSelection();
}

function calculateLevelForData(targetNode) {
	const nodeLevel = nodeNameToLevel.get(targetNode.nodeName);
	if (!isNaN(nodeLevel)) {
		return nodeLevel;
	}

	// fall back to basic paragraph
	return pLevel;
}

function promoteNode(targetNode) {
	if (targetNode && targetNode.classList && targetNode.nodeName === "P") {
		const currentTargetLevel = getOrCalculateNodeLevel(targetNode);
		const adjustedLevel = currentTargetLevel - pLevel;
		if (adjustedLevel > 0) {
			let newAdjustedLevel = adjustedLevel - 1;
			setListLevel(targetNode, newAdjustedLevel);
			return true;
		}
	}

	return convertNodeByMap(promotionMap, targetNode);
}

function promoteSelectedNodes() {
	let targetNode;
	for (targetNode of selectedFullyVisibleElements()) {
		promoteNode(targetNode);
	}
	restoreSelection();
}

function demoteNode(targetNode) {
	if (targetNode && targetNode.classList && targetNode.nodeName === "P") {
		const currentTargetLevel = getOrCalculateNodeLevel(targetNode);
		const adjustedLevel = currentTargetLevel - pLevel;
		if (adjustedLevel >= 0) {
			let newAdjustedLevel = adjustedLevel + 1;
			// don't demote into hidden level
			if (showingLevel >= maxShowingLevel) {
				setListLevel(targetNode, newAdjustedLevel);
				return true;
			}
		}
	}

	return convertNodeByMap(demotionMap, targetNode);
}

function demoteSelectedNodes() {
	let targetNode;
	for (targetNode of selectedFullyVisibleElements()) {
		demoteNode(targetNode);
	}
	restoreSelection();
}

function matchContextListType(inNode) {
	const nodeLevel = getOrCalculateNodeLevel(inNode);
	if (nodeLevel > pLevel) { // Bullet point needs to adopt what's before it
		const contextSearch = previousVisibleOrderableSiblingOfLevelOrHigher(inNode, nodeLevel);
		const contextElement = contextSearch.sibling;
		if (contextElement) {
			const contextLevel = getOrCalculateNodeLevel(contextElement);
			if (contextLevel === nodeLevel) {
				// Match numbered-ness
				if (contextElement.classList.contains("altA")) {
					inNode.classList.add("altA");
				} else {
					inNode.classList.remove("altA");
				}
			}
		}
	}
}

// assumes updateSelection() valid before calling
function canDoTab() {
	if (isSelection()) { // selection => demote
		return true;
	} else if (currentSelection.startElement && currentSelection.startElement.classList) {
		if (currentSelection.startOffset === 0) { // single element, but we're at the beginning => demote
			const currentNodeLevel = getOrCalculateNodeLevel(currentSelection.startElement);
			if (currentNodeLevel && currentNodeLevel >= pLevel) {
				return true;
			}
		}
		// TODO: else, make columns / tables
	}
	return false;
}

function doTab() {
	if (isSelection()) { // selection => demote
		recountHandled = true;
		demoteSelectedNodes();
		if (isSingleElementSelection()) {
			matchContextListType(currentSelection.startElement);
		}
		countChildWords();
		return true;
	} else if (currentSelection.startElement && currentSelection.startElement.classList) {
		if (currentSelection.startOffset === 0) { // single element, but we're at the beginning => demote
			const currentNodeLevel = getOrCalculateNodeLevel(currentSelection.startElement);
			if (currentNodeLevel >= pLevel) {
				// indenting at the beginning? that's list-making
				setListLevel(currentSelection.startElement, currentNodeLevel - pLevel + 1);
				matchContextListType(currentSelection.startElement);
				return true;
			}
		}
		// TODO: else, make columns / tables
	}
	return false;
}

function doToggleAltA(targetNode) {
	if (targetNode && targetNode.classList) {
		const currentNodeLevel = getOrCalculateNodeLevel(targetNode);
		if (currentNodeLevel >= pLevel) { // Currently only have AltA configured for non-headings
			targetNode.classList.toggle("altA");
		}
	}
}

function doToggleAltB(targetNode) {
	if (targetNode && targetNode.classList) {
		const currentNodeLevel = getOrCalculateNodeLevel(targetNode);
		if (currentNodeLevel >= pLevel) { // Currently only have AltB configured for non-headings
			targetNode.classList.toggle("altB");
		}
	}
}

let isPasting = false;
let numNodesBeforePaste = 0;
let numNodesPastingInto = 0;
let nodePastingAfter = null;
let recountHandled = false;
let isMovingSection = false;

function thisOrLastHiddenChild(inNode) {
	let currentNode = getOrderableParent(inNode);
	let thisOrLastHidden = currentNode;
	while (currentNode) {
		if (currentNode.classList) {
			if (!currentNode.classList.contains("hiddenParent") && !currentNode.classList.contains("hidden")) {
				break;
			}
			thisOrLastHidden = currentNode;
		}
		currentNode = currentNode.nextSibling;
	}
	return thisOrLastHidden;
}

function thisOrLastChild(inNode) {
	let currentNode = getOrderableParent(inNode);
	if (currentNode) {
		let targetNode = currentNode;
		for (targetNode of childNodesOf(inNode)) {
		}
		return targetNode;
	}
	return null;
}

function thisOrLastChildBelowLevel(inNode, inLevel) {
	let currentNode = getOrderableParent(inNode);
	if (currentNode) {
		let previousNode = currentNode;
		let targetNode = currentNode;
		for (targetNode of childElementsOf(inNode)) {
			const targetLevel = getOrCalculateNodeLevel(targetNode);
			if (targetLevel <= inLevel) {
				return previousNode;
			}
			previousNode = targetNode;
		}
		return targetNode;
	}
	return null;
}

function expandSelectionToIncludeHiddenChildren() {
	if (currentSelection && currentSelection.endElement) {
		const endNode = thisOrLastHiddenChild(currentSelection.endElement);
		if (endNode !== currentSelection.endElement) {
			currentSelection.endElement = endNode;
			return true;
		}
	}
	return false;
}

function expandSelectionToIncludeLastChildren() {
	if (currentSelection && currentSelection.endElement) {
		const endNode = thisOrLastChild(currentSelection.endElement);
		if (endNode !== currentSelection.endElement) {
			currentSelection.endElement = endNode;
			return true;
		}
	}
	return false;
}

function expandSelectionToIncludeChildrenBelowLevel(inLevel) {
	if (currentSelection && currentSelection.endElement) {
		const endNode = thisOrLastChildBelowLevel(currentSelection.endElement, inLevel);
		if (endNode !== currentSelection.endElement) {
			currentSelection.endElement = endNode;
			return true;
		}
	}
	return false;
}

function expandSelectionToIncludeAllChildren() {
	let highestLevel = Infinity;
	let currentNode;
	for (currentNode of selectedElements()) {
		const currentLevel = getOrCalculateNodeLevel(currentNode);
		highestLevel = Math.min(currentLevel, highestLevel);
	}

	if (!currentNode) {
		return false;
	}

	let thisOrLast = currentSelection.endElement;
	currentNode = thisOrLast ? thisOrLast.nextSibling : null;
	while (currentNode) {
		if (currentNode.classList) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel > highestLevel) {
				// still a child node
				thisOrLast = currentNode;
			} else {
				break;
			}
		}
		currentNode = currentNode.nextSibling;
	}

	if (thisOrLast !== currentSelection.endElement) {
		// new end element found and set!
		currentSelection.endElement = thisOrLast;
		currentSelection.endNode = thisOrLast.firstChild ? thisOrLast.firstChild : thisOrLast;
		currentSelection.endOffset = 0;
		return true;
	}
	return false;
}

function previousVisibleOrderableSiblingOfLevelOrHigher(inNode, inLevel) {
	let currentNode = getOrderableParent(inNode);
	let isImmediate = true;
	if (currentNode) {
		currentNode = currentNode.previousSibling;
	}
	while (currentNode) {
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel <= inLevel) {
				break;
			}
		}
		currentNode = currentNode.previousSibling;
		isImmediate = false;
	}
	return {
		sibling: currentNode,
		isImmediate: isImmediate
	};
}

function previousVisibleOrderableSiblingOfLevel(inNode, inLevel) {
	let currentNode = getOrderableParent(inNode);
	let isImmediate = true;
	if (currentNode) {
		currentNode = currentNode.previousSibling;
	}
	while (currentNode) {
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel === inLevel) {
				break;
			}
		}
		currentNode = currentNode.previousSibling;
		isImmediate = false;
	}
	return {
		sibling: currentNode,
		isImmediate: isImmediate
	};
}

function previousVisibleOrderableSibling(inNode) {
	let currentNode = getOrderableParent(inNode);
	let isImmediate = true;
	if (currentNode) {
		currentNode = currentNode.previousSibling;
	}
	while (currentNode) {
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			break;
		}
		currentNode = currentNode.previousSibling;
		isImmediate = false;
	}
	return {
		sibling: currentNode,
		isImmediate: isImmediate
	};
}

function nextVisibleOrderableSiblingOfLevelOrHigher(inNode, inLevel) {
	let currentNode = getOrderableParent(inNode);
	let isImmediate = true;
	if (currentNode) {
		currentNode = currentNode.nextSibling;
	}
	while (currentNode) {
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel <= inLevel) {
				break;
			}
		}
		currentNode = currentNode.nextSibling;
		isImmediate = false;
	}
	return {
		sibling: currentNode,
		isImmediate: isImmediate
	};
}

function nextVisibleOrderableSiblingOfLevel(inNode, inLevel) {
	let currentNode = getOrderableParent(inNode);
	let isImmediate = true;
	if (currentNode) {
		currentNode = currentNode.nextSibling;
	}
	while (currentNode) {
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			const currentLevel = getOrCalculateNodeLevel(currentNode);
			if (currentLevel === inLevel) {
				break;
			}
		}
		currentNode = currentNode.nextSibling;
		isImmediate = false;
	}
	return {
		sibling: currentNode,
		isImmediate: isImmediate
	};
}

function nextVisibleOrderableSibling(inNode) {
	let currentNode = getOrderableParent(inNode);
	let isImmediate = true;
	if (currentNode) {
		currentNode = currentNode.nextSibling;
	}
	while (currentNode) {
		if (currentNode.classList && !currentNode.classList.contains("hiddenParent")) {
			break;
		}
		currentNode = currentNode.nextSibling;
		isImmediate = false;
	}
	return {
		sibling: currentNode,
		isImmediate: isImmediate
	};
}

function increaseShowingLevel() {
	const isSingle = isSingleElementSelection();
	const result = setShowingLevel(Math.max(showingLevel - 1, 0));
	// now we need to change the selection to something shown
	let newSelectedElement = null;
	if (currentSelection.startElement && getOrCalculateNodeLevel(currentSelection.startElement) > showingLevel) {
		clearParagraphHighlights();
		const previousVisibleSibling = previousVisibleOrderableSiblingOfLevelOrHigher(currentSelection.startElement, showingLevel).sibling;
		if (previousVisibleSibling) {
			// select end
			const endChild = findNodeAndOffset(previousVisibleSibling, Infinity);
			currentSelection.startElement = previousVisibleSibling;
			if (endChild.leafNode) {
				currentSelection.startNode = endChild.leafNode;
				currentSelection.startOffset = endChild.offset;
			} else {
				currentSelection.startNode = currentSelection.startElement;
				currentSelection.startOffset = 0;
			}
		} else { // no previous sibling? we need to go next, then
			const nextVisibleSibling = nextVisibleOrderableSiblingOfLevelOrHigher(currentSelection.startElement, showingLevel).sibling;
			if (nextVisibleSibling) {
				// select beginning
				const startChild = findNodeAndOffset(nextVisibleSibling, 0);
				currentSelection.startElement = nextVisibleSibling;
				if (startChild.leafNode) {
					currentSelection.startNode = startChild.leafNode;
					currentSelection.startOffset = startChild.offset;
				} else {
					currentSelection.startNode = currentSelection.startElement;
					currentSelection.startOffset = 0;
				}
			}
		}
		// what about the end of the selection, though?
		if (isSingle) {
			currentSelection.endElement = currentSelection.startElement;
			currentSelection.endNode = currentSelection.startNode;
			currentSelection.endOffset = currentSelection.startOffset;
		} else if (getOrCalculateNodeLevel(currentSelection.endElement) > showingLevel) {
			const visibleSiblingBeforeEnd = previousVisibleOrderableSiblingOfLevelOrHigher(currentSelection.endElement, showingLevel).sibling;
			if (!visibleSiblingBeforeEnd) { // full collapse
				currentSelection.endElement = currentSelection.startElement;
				currentSelection.endNode = currentSelection.startNode;
				currentSelection.endOffset = currentSelection.startOffset;
			} else {
				// select end
				const endChild = findNodeAndOffset(visibleSiblingBeforeEnd, Infinity);
				currentSelection.endElement = visibleSiblingBeforeEnd;
				if (endChild.leafNode) {
					currentSelection.endNode = endChild.leafNode;
					currentSelection.endOffset = endChild.offset;
				} else {
					currentSelection.endNode = currentSelection.endElement;
					currentSelection.endOffset = 0;
				}
			}
		}
		// we've done all we can. Now:
		restoreSelection(true);
		addParagraphHighlights();
	}

	return result;
}

function decreaseShowingLevel() {
	return setShowingLevel(Math.min(showingLevel + 1, maxShowingLevel));
}

function setShowingLevel(inLevel) {
	const newLevelTarget = (inLevel >= maxShowingLevel) ? pLevel + maxIndentLevel : inLevel;

	const changedLevel = inLevel !== showingLevel;
	showingLevel = inLevel;

	let currentNode;
	for (currentNode of allUserElements()) {
		const currentLevel = getOrCalculateNodeLevel(currentNode);
		if (currentLevel <= newLevelTarget) {
			currentNode.classList.remove("hiddenLevel");
		} else {
			currentNode.classList.add("hiddenLevel");
		}
	}

	return changedLevel;
}

function moveUpSimple() {
	recountHandled = true;
	updateSelection();
	const beforeExpansion = copyCurrentSelection();
	expandSelectionToIncludeHiddenChildren();
	const movingSection = showingLevel < maxShowingLevel;
	if (movingSection) {
		expandSelectionToIncludeChildrenBelowLevel(showingLevel);
	}
	if (currentSelection.startElement) {
		const previousElement = movingSection ? previousVisibleOrderableSiblingOfLevelOrHigher(currentSelection.startElement, showingLevel).sibling
			: previousVisibleOrderableSibling(currentSelection.startElement).sibling;
		if (previousElement) {
			previousElement.before(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection(true);
			return true;
		} else if (currentSelection.startElement !== userDoc.firstChild && !movingSection) {
			// insert at beginning
			userDoc.prepend(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection(true);
			return true;
		} else {
			setCurrentSelection(beforeExpansion);
		}
	} else {
		setCurrentSelection(beforeExpansion);
	}
	return false;
}

function moveDownSimple() {
	recountHandled = true;
	updateSelection();
	const beforeExpansion = copyCurrentSelection();
	expandSelectionToIncludeHiddenChildren();
	const movingSection = showingLevel < maxShowingLevel;
	if (movingSection) {
		expandSelectionToIncludeChildrenBelowLevel(showingLevel);
	}
	if (currentSelection.endElement) {
		if (movingSection) {
			const nextRelevantElement = nextVisibleOrderableSiblingOfLevelOrHigher(currentSelection.endElement, showingLevel).sibling;
			if (nextRelevantElement) {
				const lastRelevantElement = nextVisibleOrderableSiblingOfLevelOrHigher(nextRelevantElement, showingLevel).sibling;
				if (lastRelevantElement) {
					// put BEFORE the next node
					lastRelevantElement.before(...selectedNodes());
					countChildWords();
					setCurrentSelection(beforeExpansion);
					restoreSelection(true);
					return true;
				} else if (currentSelection.endElement !== userDoc.lastChild) {
					// insert at end
					userDoc.append(...selectedNodes());
					countChildWords();
					setCurrentSelection(beforeExpansion);
					restoreSelection(true);
					return true;
				} else {
					setCurrentSelection(beforeExpansion);
				}
			}  else if (currentSelection.endElement !== userDoc.lastChild) {
				// insert at end
				userDoc.append(...selectedNodes());
				countChildWords();
				setCurrentSelection(beforeExpansion);
				restoreSelection(true);
				return true;
			} else {
				setCurrentSelection(beforeExpansion);
			}
		} else {
			const nextElement = thisOrLastHiddenChild(nextVisibleOrderableSibling(currentSelection.endElement).sibling);
			if (nextElement) {
				nextElement.after(...selectedNodes());
				countChildWords();
				setCurrentSelection(beforeExpansion);
				restoreSelection(true);
				return true;
			} else if (currentSelection.endElement !== userDoc.lastChild) {
				// insert at end
				userDoc.append(...selectedNodes());
				countChildWords();
				setCurrentSelection(beforeExpansion);
				restoreSelection(true);
				return true;
			} else {
				setCurrentSelection(beforeExpansion);
			}
		}
	} else {
		setCurrentSelection(beforeExpansion);
	}
	return false;
}

function moveUpSection() {
	recountHandled = true;
	updateSelection();
	const beforeExpansion = copyCurrentSelection();
	expandSelectionToIncludeAllChildren();
	if (currentSelection.startElement) {
		const currentNodeLevel = getOrCalculateNodeLevel(currentSelection.startElement);
		const previousSearch = previousVisibleOrderableSiblingOfLevelOrHigher(currentSelection.startElement, currentNodeLevel);
		const previousElement = previousSearch.sibling;
		if (previousElement) {
			previousElement.before(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection(true);
			return true;
		} else {
			setCurrentSelection(beforeExpansion);
		}
	} else {
		setCurrentSelection(beforeExpansion);
	}
	return false;
}

function moveDownSection() {
	recountHandled = true;
	updateSelection();
	const beforeExpansion = copyCurrentSelection();
	expandSelectionToIncludeAllChildren();
	if (currentSelection.startElement) {
		const currentNodeLevel = getOrCalculateNodeLevel(currentSelection.startElement);
		const nextSearch = nextVisibleOrderableSiblingOfLevelOrHigher(thisOrLastChild(currentSelection.startElement), currentNodeLevel);
		let nextElement = nextSearch.sibling;
		if (nextElement) {
			const lastSearch = nextVisibleOrderableSiblingOfLevelOrHigher(nextElement, currentNodeLevel);
			if (lastSearch.sibling) {
				// put BEFORE the next node
				lastSearch.sibling.before(...selectedNodes());
				countChildWords();
				setCurrentSelection(beforeExpansion);
				restoreSelection(true);
				return true;
			} else if (currentSelection.endElement !== userDoc.lastChild) {
				// insert at end
				userDoc.append(...selectedNodes());
				countChildWords();
				setCurrentSelection(beforeExpansion);
				restoreSelection(true);
				return true;
			} else {
				setCurrentSelection(beforeExpansion);
			}
		}  else if (currentSelection.endElement !== userDoc.lastChild) {
			// insert at end
			userDoc.append(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection(true);
			return true;
		} else {
			setCurrentSelection(beforeExpansion);
		}
	} else {
		setCurrentSelection(beforeExpansion);
	}
	return false;
}

function inputOverrides(event) {
	let newInputType = inputEventNoCategory;

	// A single Unicode character means it's a typed text input:
	if (event.key.length === 1 && event.key.codePointAt(0)) {
		newInputType = inputEventText;
		updateSelection();
	}

	let isArrowLeftEvent = false;
	let isArrowUpEvent = false;
	let isArrowRightEvent = false;
	let isArrowDownEvent = false;
	switch (event.keyCode) {
		case 37:
			arrowLeftPressed = true;
			isArrowLeftEvent = true;
			break;
		case 38:
			arrowUpPressed = true;
			isArrowUpEvent = true;
			break;
		case 39:
			arrowRightPressed = true;
			isArrowRightEvent = true;
			break;
		case 40:
			arrowDownPressed = true;
			isArrowDownEvent = true;
			break;
	}
	const isArrowEvent = isArrowLeftEvent || isArrowUpEvent || isArrowRightEvent || isArrowDownEvent;

	if (event.altKey) {
		altPressed = true;
	}
	if (event.shiftKey) {
		shiftPressed = true;
	}

	const altShiftBeginning = (event.altKey && event.key === "Shift") || (event.shiftKey && event.key === "Alt");
	if (altShiftBeginning) {
		updateSelection();
		if (isSingleElementSelection() && currentSelection.startElement) {
			let targetNode;
			for (targetNode of childElementsOf(currentSelection.startElement)) {
				targetNode.dataset.selectionChild = "true";
			}
		}
	}

	if (event.altKey) {
		if (event.shiftKey) {
			// Navigate shortcuts
			if (arrowUpPressed) { // Move Section Up
				event.preventDefault();
				if (isSingleElementSelection()) {
					finishUndo();
					newInputType = inputEventMove;
					moveUpSection();
				}
			} else if (arrowDownPressed) { // Move Section Down
				event.preventDefault();
				if (isSingleElementSelection()) {
					finishUndo();
					newInputType = inputEventMove;
					moveDownSection();
				}
			} else if (arrowLeftPressed) {
				event.preventDefault();
				updateSelection();
				updateCaretViewportPosition();
				if (increaseShowingLevel()) {
					scrollToMaintainCaretViewportPosition();
				}
			} else if (arrowRightPressed) {
				event.preventDefault();
				updateSelection();
				updateCaretViewportPosition();
				if (decreaseShowingLevel()) {
					scrollToMaintainCaretViewportPosition();
				}
			} else if (event.key === "Enter") { // Toggle Alternative Style B
				event.preventDefault();
				finishUndo();
				newInputType = inputEventToggleAltB;
				updateSelection();
				let targetNode;
				for (targetNode of selectedVisibleElements()) {
					doToggleAltB(targetNode);
				}
			}
		} else {
			// Move shortcuts
			if (arrowUpPressed) { // Move Up
				event.preventDefault();
				finishUndo();
				newInputType = inputEventMove;
				moveUpSimple();
			} else if (arrowDownPressed) { // Move Down
				event.preventDefault();
				finishUndo();
				newInputType = inputEventMove;
				moveDownSimple();
			} else if (arrowLeftPressed) { // Promote/Adjust
				event.preventDefault();
				finishUndo();
				newInputType = inputEventPromote;
				recountHandled = true;
				updateSelection();
				const isSingle = isSingleElementSelection();
				promoteSelectedNodes();
				if (isSingle) {
					matchContextListType(currentSelection.startElement);
				}
				countChildWords();
			} else if (arrowRightPressed) { // Demote/Adjust
				event.preventDefault();
				finishUndo();
				newInputType = inputEventPromote;
				recountHandled = true;
				updateSelection();
				const isSingle = isSingleElementSelection();
				demoteSelectedNodes();
				if (isSingle) {
					matchContextListType(currentSelection.startElement);
				}
				countChildWords();
			} else if (event.key === "h") { // Hide/Unhide
				// work from end to beginning of selection, toggling hidden status
				event.preventDefault();
				finishUndo();
				newInputType = inputEventHide;
				recountHandled = true;
				updateSelection();
				if (currentSelection.startElement && currentSelection.endElement) {
					let needsRecount = false;
					let targetNode;
					for (targetNode of selectedElementsReversed()) {
						needsRecount = toggleHidden(targetNode) || needsRecount;
					}
					if (needsRecount) {
						countChildWords();
					}
				}
			} else if (event.key === "Backspace") { // Remove
				event.preventDefault();
				finishUndo();
				newInputType = inputEventRemove;
				updateSelection();
				expandSelectionToIncludeHiddenChildren();
				let targetNode;
				for (targetNode of selectedNodes()) {
					targetNode.remove();
				}
			} else if (event.key === "Enter") { // Toggle Alternative Style A
				event.preventDefault();
				finishUndo();
				newInputType = inputEventToggleAltA;
				updateSelection();
				let targetNode;
				for (targetNode of selectedVisibleElements()) {
					doToggleAltA(targetNode);
				}
			} else if (event.key === "s") { // Export to "other" format (if already "with editor", save just the content; if already just content, save "with editor")
				event.preventDefault();
				if (isEditorBuiltInSession) { // Export just content
					saveWithoutHighlights(true);
				} else { // Export with editor
					saveWithEditor(true);
				}
			} else if (event.key === "n") { // New session
				event.preventDefault();
				newSession();
			}
		}
	} else if (event.ctrlKey) {
		if (event.key === "z") { // Undo
			event.preventDefault();
			newInputType = inputEventUndoRedo;
			doUndo();
		} else if (event.key === "Z") { // Redo
			event.preventDefault();
			newInputType = inputEventUndoRedo;
			doRedo();
		} else if (event.key === "s") { // Save content to file
			event.preventDefault();
			if (isEditorBuiltInSession) { // If this editor is built into the doc, we don't want to risk over-writing with a "content-only" file, so force it to save with editor
				saveWithEditor(false);
			} else {
				saveWithoutHighlights(false); // Otherwise, this just saves the content in the doc for opening from the editor
			}
		} else if (event.key === "S") { // Save As
			event.preventDefault();
			if (isEditorBuiltInSession) {
				saveWithEditor(true);
			} else {
				saveWithoutHighlights(true);
			}
		} else if (event.key === "o") { // Open content file
			event.preventDefault();
			openFile();
		}
	} else {
		if (event.key === "Tab") {
			updateSelection();
			if (canDoTab()) {
				event.preventDefault();
				newInputType = inputEventPromote;
				doTab();
			}
		} else if (event.key === " ") { // space at beginning does "tab"
			updateSelection();
			if (!isSelection() && currentSelection.endNode) {
				if (currentSelection.startOffset === 0) {
					if (canDoTab()) {
						event.preventDefault();
						newInputType = inputEventPromote;
						doTab();
					}
				}
			}
		} else if (event.key === "Backspace") {
			const targetNode = updateSelection();
			if (!isSelection() && targetNode && targetNode.classList) {
				let didBackspace = false;
				if (getOffsetInParentNode(currentSelection.startElement, currentSelection.startNode, currentSelection.startOffset) === 0) {
					const currentNodeLevel = getOrCalculateNodeLevel(targetNode);
					if (currentNodeLevel > pLevel) {
						event.preventDefault();
						finishUndo();
						newInputType = inputEventPromote;
						// promote by one
						setListLevel(targetNode, currentNodeLevel - pLevel - 1);
						matchContextListType(targetNode);
						didBackspace = true;
					}
				}
				if (!didBackspace) {
					if (currentSelection.charBefore === "\u00A0" || currentSelection.charBefore === " ") {
						finishUndo();
					}
					newInputType = inputEventBackspace;
					didBackspace = true;
				}
			}
		} else if (event.key === "Enter") { // Lots of special case stuff here
			const targetNode = updateSelection();
			if (showingLevel < maxShowingLevel) { // Don't do anything when not showing paragraphs
				event.preventDefault();
			} else if (targetNode && targetNode.classList) {
				// if we have no words or we're before all words, promote to P
				let processedEnter = false;
				if (getOrCalculateNodeWordCount(targetNode) === 0 ||
					getOffsetInParentNode(currentSelection.startElement, currentSelection.startNode, currentSelection.startOffset) === 0) {
					const currentNodeLevel = getOrCalculateNodeLevel(targetNode);
					if (currentNodeLevel !== pLevel || targetNode.classList.contains("altA") || targetNode.classList.contains("altB")) {
						event.preventDefault();
						newInputType = inputEventPromote;
						if (currentNodeLevel === pLevel) { // clear alt modes
							targetNode.classList.remove("altA");
							targetNode.classList.remove("altB");
						} else if (currentNodeLevel > pLevel) { // promote by one
							setListLevel(targetNode, currentNodeLevel - pLevel - 1);
							matchContextListType(currentSelection.startElement);
						} else { // let's also convert headings to paragraphs as appropriate
							convertNodeToType(targetNode, "P");
							restoreSelection(true);
						}
						processedEnter = true;
					}
				}
				let needsToClear = true;
				if (!processedEnter) {
					const isSelectionRange = isSelection();
					event.preventDefault();
					newInputType = inputEventEnter;
					const offsetInElement = getOffsetInParentNode(currentSelection.endElement, currentSelection.endNode, currentSelection.endOffset);
					let newNode = splitAtOffset(currentSelection.endElement, offsetInElement);
					// TODO: split deleting / collapsing selection into another function?
					if (isSelectionRange) {
						const beforeOffset = getOffsetInParentNode(currentSelection.startElement, currentSelection.startNode, currentSelection.startOffset);
						splitAtOffset(currentSelection.startElement, beforeOffset);
						// remove all of the in-betweens
						if (currentSelection.startElement !== currentSelection.endElement) {
							let firstToDelete = currentSelection.startElement.nextSibling;
							let isLastElement = false;
							while (!isLastElement) {
								isLastElement = firstToDelete === currentSelection.endElement;
								const nextToDelete = firstToDelete.nextSibling;
								firstToDelete.remove();
								firstToDelete = nextToDelete;
							}
						}
					}
					let afterWordCount = 0;
					if (newNode) {
						calculateAndSetNodeWordCount(newNode);
						afterWordCount = getNodeWordCount(newNode);
					}
					calculateAndSetNodeWordCount(targetNode);
					const beforeWordCount = getNodeWordCount(targetNode);
					if (targetNode instanceof HTMLHeadingElement) {
						// don't use the copy straight-up -- do a new paragraph
						const newParagraph = document.createElement("p");
						if (!newNode || afterWordCount === 0) {
							newParagraph.appendChild(document.createElement("br"));
						} else {
							newParagraph.append(...newNode.childNodes);
						}
						targetNode.after(newParagraph);
						newNode = newParagraph;
					} else if (newNode && afterWordCount > 0) {
						targetNode.after(newNode);
					} else {
						const newParagraph = targetNode.cloneNode(false);
						newParagraph.appendChild(document.createElement("br"));
						targetNode.after(newParagraph);
						newNode = newParagraph;
					}

					// Update selection:
					const newRange = document.createRange();
					newRange.setStart(newNode, 0);
					const newSelection = document.getSelection();
					newSelection.removeAllRanges();
					newSelection.addRange(newRange);

					countChildWords();
				}
			}
		}
	}

	if (newInputType === inputEventNoCategory && isArrowEvent) {
		newInputType = inputEventMoveCaret;
	}


	if (newInputType !== inputEventNoCategory && newInputType !== previousInputType && newInputType !== inputEventUndoRedo) {
		finishUndo();
	} else {
		if (newInputType === inputEventText) {
			if (event.key === " ") {
				finishUndo();
			}
		}
	}
	currentInputType = newInputType;
}

function keyRelease(inputEvent) {
	switch (inputEvent.keyCode) {
		case 37:
			arrowLeftPressed = false;
			break;
		case 38:
			arrowUpPressed = false;
			break;
		case 39:
			arrowRightPressed = false;
			break;
		case 40:
			arrowDownPressed = false;
			break;
	}

	if (!event.altKey) {
		altPressed = false;
	}
	if (!event.shiftKey) {
		shiftPressed = false;
	}

	const altShiftEnding = (event.altKey && event.key === "Shift") || (event.shiftKey && event.key === "Alt");
	if (altShiftEnding) {
		if (isSingleElementSelection() && currentSelection.startElement) {
			let targetNode;
			for (targetNode of childElementsOf(currentSelection.startElement)) {
				delete targetNode.dataset.selectionChild;
			}
		}
	}
}

function clearParagraphHighlights() {
	let numNodesCleared = 0;
	let currentNode;
	for (currentNode of selectedElements()) {
		delete currentNode.dataset.selected;
		numNodesCleared++;
	}
	if (isSingleElementSelection() && currentSelection.startElement) {
		for (targetNode of childElementsOf(currentSelection.startElement)) {
			delete targetNode.dataset.selectionChild;
		}
	}
	return numNodesCleared;
}

function addParagraphHighlights() {
	let currentNode;
	for (currentNode of selectedElements()) {
		currentNode.dataset.selected = "true";
	}
	if (isSingleElementSelection() && shiftPressed && altPressed && currentSelection.startElement) {
		for (targetNode of childElementsOf(currentSelection.startElement)) {
			targetNode.dataset.selectionChild = "true";
		}
	}
}

function selectionChange(event) {
	// this happens after EVERY change, so it could be useful for:
	//	- detecting meaningful that don't get proper events
	// 	- sanitising pasted content
	//	- updating undo/redo stack

	if (userDoc.dataset.undoPaused || doingUndo || doingRedo) {
		return;
	}

	if (isPasting) {
		isPasting = false;
		let numNodesToSanitize = Math.max(userDoc.childNodes.length - numNodesBeforePaste + numNodesPastingInto, 1);
		
		let firstNodeToSanitize = userDoc.firstChild;
		if (nodePastingAfter && nodePastingAfter.nextSibling) {
			firstNodeToSanitize = nodePastingAfter.nextSibling;
		}
		if (firstNodeToSanitize) {
			// unnest first
			numNodesToSanitize += unnestNodes(firstNodeToSanitize);
			// sanitize will remove disallowed nodes and clean up empty ones
			sanitizeNodes(firstNodeToSanitize, numNodesToSanitize);

			// update current selection
			updateSelection();

			// apply relevant selected style
			addParagraphHighlights();
		}

		countChildWords();
		recountHandled = false;
	} else {
		// has selected node changed?
		const previousSelectionStartElement = currentSelection.startElement;
		const previousSelectionStartNode = currentSelection.startNode;
		const previousSelectionStartOffset = currentSelection.startOffset;
		const previousSelectionEndElement = currentSelection.endElement;
		const previousSelectionEndNode = currentSelection.endNode;
		const previousSelectionEndOffset = currentSelection.endOffset;
		const wasRange = currentSelection.startOffset !== currentSelection.endOffset ||
			currentSelection.startNode !== currentSelection.endNode &&
			currentSelection.startElement !== currentSelection.endElement;

		// clear current highlights
		clearParagraphHighlights();

		// compare with previous selection
		updateSelection();
		const startChanged = previousSelectionStartElement !== currentSelection.startElement;
		const endChanged = previousSelectionEndElement !== currentSelection.endElement;
		const isRange = currentSelection.startOffset !== currentSelection.endOffset ||
			currentSelection.startNode !== currentSelection.endNode &&
			currentSelection.startElement !== currentSelection.endElement;
		
		let bigChange = false;
		// different events may require different clean-up
		switch (currentInputType) {
		//	case inputEventText:
		//		break;
			case inputEventEnter: // New bullet points don't keep "checked" status
				const currentNodeLevel = getOrCalculateNodeLevel(currentSelection.startElement);
				if (currentNodeLevel > pLevel) {
					currentSelection.startElement.classList.remove("altB");
				}
				break;
			case inputEventText:
			case inputEventNoCategory:
				// Could be a change shoved in (thanks to mobile), so check for those:
				if (!wasRange && !isRange && currentSelection.startOffset === previousSelectionStartOffset + 1 && !startChanged) {
					if (currentSelection.startOffset === 1 && (currentSelection.charBefore === "\u00A0" || currentSelection.charBefore === " ")) {
						// Delete that first space
						textUnderCaret = getStringIfTextNode(currentSelection.startNode);
						if (textUnderCaret) {
							currentSelection.startNode.data = currentSelection.startNode.data.slice(1);
							demoteNode(currentSelection.startElement);
							matchContextListType(currentSelection.startElement);
							currentSelection.startOffset = 0;
							currentSelection.endOffset = 0;
							restoreSelection(true);
							bigChange = true;
						}
					}
				}
				if (currentInputType === inputEventNoCategory) {
					finishUndo();
				}
				break;
			default:
				break;
		}
		
		let nodeForDelta = null;
		let nodeDelta = 0;
		let targetNode;
		for (targetNode of selectedFullyVisibleElements()) {
			const wordCalc = calculateAndSetNodeWordCount(targetNode);
			if (!wordCalc.hadValidData) {
				bigChange = true;
				nodeForDelta = null;
			} else if (wordCalc.deltaWords) {
				if (nodeForDelta) {
					// we've already had to recalculate another node, so this is now a big change
					bigChange = true;
					nodeForDelta = null;
				} else {
					// store up just this node in case it's the only one that's changed
					nodeForDelta = targetNode;
					nodeDelta = wordCalc.deltaWords;
				}
			}
		}

		if (bigChange) {
			// re-count all the children!
			countChildWords();
		} else if (nodeForDelta) {
			updateParentNodeChildWords(nodeForDelta, nodeDelta);
		}

		recountHandled = false;

		// apply relevant selected style
		addParagraphHighlights();
	}

	// For most selection change events, we want to move to keep it in view:
	if (currentInputType > inputEventNoCategory && currentInputType < inputEventUndoRedo) {
		scrollToSelectedElementIfNeeded();
	}

	previousInputType = currentInputType;
	currentInputType = inputEventNoCategory;
}

function pasting(event) {
	isPasting = true;
	nodePastingAfter = updateSelection();
	if (nodePastingAfter) {
		nodePastingAfter = nodePastingAfter.previousSibling;
	}
	numNodesBeforePaste = userDoc.childNodes.length;
	numNodesPastingInto = clearParagraphHighlights();
}

function newSession() {
	stopUndoRedoObserver();

	userDoc.innerHTML = defaultContent;
	isEditorBuiltInSession = false;
	currentFileName = "";
	document.title = titleNoFile;
	currentFileHandle = null;
	undoStack.length = 0;
	redoStack.length = 0;

	startUndoRedoObserver();
}

function saveSession() {
	clearParagraphHighlights();
	const sessionKey = currentFileName ? currentFileName : "lastSession";
	localStorage.setItem(sessionKey, userDoc.innerHTML);
	addParagraphHighlights();
}

function loadSession() {
	defaultContent = userDoc.innerHTML;
	let allowLastSessionFallback = true;
	if (isEditorBuiltInSession) {
		// If this file is content+editor, then we want to avoid overriding content unless we are sure it's relevant to this file.
		allowLastSessionFallback = false;
	}
	if (currentFileName) {
		const lastSession = localStorage.getItem(currentFileName);
		if (lastSession) {
			userDoc.innerHTML = lastSession;
			return true;
		}
	}
	if (allowLastSessionFallback) {
		const lastSession = localStorage.getItem("lastSession");
		if (lastSession) {
			userDoc.innerHTML = lastSession;
			return true;
		}
	}
	return false;
}

function visibilityChange() {
	if (document.visibilityState === "hidden") {
		saveSession();
	}
}

function load(event) {
	currentFileName = window.location.pathname.split('/').pop();
	isEditorBuiltInSession = document.title === savedWithEditorTitle;
	if (loadSession() && !isEditorBuiltInSession) {
		document.title = "Continuing last session" + titleTail;
	} else if (isEditorBuiltInSession && currentFileName) {
		document.title = currentFileName + editorTitleTail;
	} else {
		document.title = titleNoFile;
	}

	startUndoRedoObserver();
}

function saveWithEditor(forceSaveAs) {
	clearParagraphHighlights();
	const currentTitle = document.title;
	document.title = savedWithEditorTitle; // This lets us know on OPEN not to override with latest session data unless it's associated with this file specifically
	saveFile("<!DOCTYPE html>" + "\n" + document.documentElement.outerHTML, !forceSaveAs, "Editor with Content as HTML");
	document.title = currentTitle;
	addParagraphHighlights();
}

function saveWithoutHighlights(forceSaveAs) {
	clearParagraphHighlights();
	saveFile(userDoc.innerHTML, !forceSaveAs, "User Content as HTML");
	addParagraphHighlights();
}

async function saveFile(fileContent, isSimpleSave, saveDescription) {
	if (!fileContent) {
		return;
	}

	let fileName = null;
	let fileHandle = isSimpleSave ? currentFileHandle : null;
	if (fileHandle) {
		// attempt regular save
		try {
			const writable = await fileHandle.createWritable();
			await writable.write(fileContent);
			await writable.close();
		} catch {
			fileHandle = null;
		}
	}

	if (!fileHandle) {
		const options = {
			types: [
				{
					description: saveDescription,
					accept: {
						"text/html": [".html"]
					},
				},
			],
			multiple: false,
		};
		try {
			fileHandle = await window.showSaveFilePicker(options);
			const file = await fileHandle.getFile();
			fileName = file.name;
			const writable = await fileHandle.createWritable();
			await writable.write(fileContent);
			await writable.close();
		} catch {
			if (isSimpleSave) {
				currentFileHandle = null;
			}
			return;
		}
	}

	if (isSimpleSave) {
		// Simple / normal saves update the document Title to show THIS is the file we are working on
		currentFileHandle = fileHandle;
		if (fileName) {
			if (isEditorBuiltInSession) {
				document.title = fileName + editorTitleTail;
			} else {
				document.title = fileName + titleTail;
			}
		}
	}
}

async function openFile() {
	const options = {
		types: [
			{
				description: "HTML Files",
				accept: {
					"text/html": [".html"]
				},
			},
		],
		excludeAcceptAllOption: true,
		multiple: false,
	};

	let contents, fileHandle;
	let fileName = null;
	try {
		[fileHandle] = await window.showOpenFilePicker(options);
		const file = await fileHandle.getFile();
		fileName = file.name;
		contents = await file.text();
	} catch {
		return;
	}

	// sanitize here:
	let foundBadNodes = false;
	let foundEditorBuiltInNodes = false;
	const template = document.createElement("template");
	template.innerHTML = contents;
	const sanitizedTemplate = document.createElement("template");
	let currentNode = template.content.firstChild;
	while (currentNode) {
		if (!currentNode.nodeName || !safeContentNodeTypes.has(currentNode.nodeName)) {
			foundBadNodes = true;
			if (currentNode.nodeName === "DIV" && currentNode.id === "userDoc") {
				foundEditorBuildInNodes = true;
				currentNode.after(...currentNode.childNodes);
				// Pull these poor buggers out
			}
			currentNode.remove();
		} else {
			sanitizedTemplate.content.append(currentNode);
		}
		currentNode = template.content.firstChild;
	}

	userDoc.innerHTML = sanitizedTemplate.innerHTML;
	template.remove();
	sanitizedTemplate.remove();
	if (foundBadNodes) {
		if (foundEditorBuildInNodes) {
			currentFileHandle = fileHandle;
			// Even if we weren't an EditorBuiltInSession, we've now attempted to open one, so consider this such a session to reduce risk of overwriting with a content file.
			isEditorBuiltInSession = true;
			document.title = currentFileName + editorTitleTail;
		} else {
			// That's fine, we can sanitize it, but don't want to make it easy to then overwrite this file.
			// So prevent simple save and update title to reflect that this content was modified to be included.
			currentFileHandle = null;
			// Definitely over-engineered this, but let's stick with it for now.
			isEditorBuiltInSession = false;
			document.title = "Imported content from " + fileName + titleTail;
		}
	} else {
		currentFileHandle = fileHandle;
		document.title = fileName + titleTail;
		// Even if we were an EditorBuiltInSession, we've now explicitly opened a Content file, so we're not anymore:
		isEditorBuiltInSession = false;
	}

	undoStack.length = 0;
	redoStack.length = 0;
}

function onScroll(event) {
	caretViewportX = -1;
	caretViewportY = -1;
}

tableOfContents.addEventListener("keydown", inputOverrides);
tableOfContents.addEventListener("keyup", keyRelease);

userDoc.addEventListener("keydown", inputOverrides);
userDoc.addEventListener("keyup", keyRelease);
userDoc.addEventListener("paste", pasting);

document.addEventListener("selectionchange", selectionChange);
document.addEventListener("visibilitychange", visibilityChange);

window.addEventListener("load", load);
window.addEventListener("scroll", onScroll);