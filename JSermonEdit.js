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
	["H1", 0],
	["H2", 1],
	["H3", 2],
	["H4", 3],
	["P", pLevel]
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
	inNode.dataset.nodeWords = newNodeWords;
	return {
		hadValidData: true,
		deltaWords: newNodeWords - nodeWords
	};
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

function setNodeChildWordCount(inNode, inWordCount) {
	inNode.dataset.childWords = inWordCount;
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

function clearNodeWordCounters(inNode) {
	delete inNode.dataset.nodeWords;
	delete inNode.dataset.childWords;
	delete inNode.dataset.wordDisplay;
}

let showingLevel = maxShowingLevel;

const currentSelection = {};
currentSelection.selectionObject = document.getSelection();
currentSelection.startNode = currentSelection.selectionObject.anchorNode;
currentSelection.startElement = currentSelection.startNode;
currentSelection.startOffset = 0;
currentSelection.endNode = currentSelection.selectionObject.focusNode;
currentSelection.endElement = currentSelection.startNode;
currentSelection.endOffset = 0;
currentSelection.focusBeforeAnchor = false;

function copyCurrentSelection() {
	const newSelection = {};
	newSelection.startNode = currentSelection.startNode;
	newSelection.startElement = currentSelection.startElement;
	newSelection.startOffset = currentSelection.startOffset;
	newSelection.endNode = currentSelection.endNode;
	newSelection.endElement = currentSelection.endElement;
	newSelection.endOffset = currentSelection.endOffset;
	return newSelection;
}

function setCurrentSelection(otherSelection) {
	currentSelection.startNode = otherSelection.startNode;
	currentSelection.startElement = otherSelection.startElement;
	currentSelection.startOffset = otherSelection.startOffset;
	currentSelection.endNode = otherSelection.endNode;
	currentSelection.endElement = otherSelection.endElement;
	currentSelection.endOffset = otherSelection.endOffset;
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

function isSelection() {
	return currentSelection.selectionObject.type === "Range";
}

function isSingleElementSelection() {
	return currentSelection.startElement === currentSelection.endElement;
}

function updateSelection() {
	const selectionObject = document.getSelection();
	currentSelection.selectionObject = selectionObject;
	if (currentSelection) {
		let focusBeforeAnchor = false;
		if (selectionObject.anchorNode === selectionObject.focusNode && selectionObject.focusOffset < selectionObject.anchorOffset) {
			focusBeforeAnchor = true;
		} else if (selectionObject.anchorNode && (selectionObject.anchorNode.compareDocumentPosition(selectionObject.focusNode) & Node.DOCUMENT_POSITION_PRECEDING)) {
			focusBeforeAnchor = true;
		}
		currentSelection.focusBeforeAnchor = focusBeforeAnchor;
		currentSelection.startNode = focusBeforeAnchor ? selectionObject.focusNode : selectionObject.anchorNode;
		currentSelection.startElement = getOrderableParent(currentSelection.startNode);
		currentSelection.startOffset = focusBeforeAnchor ? selectionObject.focusOffset : selectionObject.anchorOffset;
		currentSelection.endNode = focusBeforeAnchor ? selectionObject.anchorNode : selectionObject.focusNode;
		currentSelection.endElement = getOrderableParent(currentSelection.endNode);
		currentSelection.endOffset = focusBeforeAnchor ? selectionObject.anchorOffset : selectionObject.focusOffset;
	} else {
		currentSelection.startNode = null;
		currentSelection.startElement = null;
		currentSelection.endNode = null;
		currentSelection.endElement = null;
		currentSelection.startOffset = 0;
		currentSelection.endOffset = 0;
		currentSelection.focusBeforeAnchor = false;
	}
	return currentSelection.startElement;
}

function restoreSelection() {
	if (currentSelection.startNode && currentSelection.startNode.isConnected && currentSelection.endNode && currentSelection.endNode.isConnected) {
		const newRange = document.createRange();
		newRange.setStart(currentSelection.startNode, currentSelection.startOffset);
		newRange.setEnd(currentSelection.endNode, currentSelection.endOffset);
		const newSelection = document.getSelection();
		newSelection.removeAllRanges();
		newSelection.addRange(newRange);
		return true;
	}
	return false;
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
		if (targetNode.classList && !targetNode.classList.contains("hiddenParent"))
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
		if (targetNode.classList && !targetNode.classList.contains("hidden") && !targetNode.classList.contains("hiddenParent"))
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
		if (targetNode.classList && !targetNode.classList.contains("hiddenParent"))
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
		if (targetNode.classList && !targetNode.classList.contains("hidden") && !targetNode.classList.contains("hiddenParent"))
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

			setNodeChildWordCount(currentNode, childWords + delta);
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

		setNodeChildWordCount(currentChild, numCountedForThisLevel);

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
	if (sanitizedLevel && sanitizedLevel > 0) {
		inNode.classList.add("userListItem");
		const newLevel = pLevel + sanitizedLevel;
		if (sanitizedLevel % 2 === 0) {
			inNode.classList.add("evenListLevel");
		} else {
			inNode.classList.remove("evenListLevel");
		}
		setNodeLevel(inNode, newLevel);
	} else {
		setNodeLevel(inNode, pLevel);
		inNode.classList.remove("userListItem");
		inNode.classList.remove("evenListLevel");
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
				targetNode.classList.remove("activeParagraph");
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

function convertNodeByMap(inputMap, targetNode) {
	if (targetNode && targetNode.classList) {
		const currentNodeName = targetNode.nodeName;
		const newNodeName = inputMap.get(currentNodeName);
		if (newNodeName) {
			const newElement = document.createElement(newNodeName);
			targetNode.after(newElement);
			newElement.append(...targetNode.childNodes);
			copyDataFromTo(targetNode, newElement);
			targetNode.remove();
			const newLevel = nodeNameToLevel.get(newElement.nodeName);
			if (!isNaN(newLevel)) {
				setNodeLevel(newElement, newLevel);
			}
			if (targetNode === currentSelection.startElement && currentSelection.startNode && !currentSelection.startNode.isConnected) {
				// Fix lost selection
				currentSelection.startNode = newElement.firstChild ? newElement.firstChild : newElement;
				currentSelection.startElement = newElement;
			}
			if (targetNode === currentSelection.endElement && currentSelection.endNode && !currentSelection.endNode.isConnected) {
				// Fix lost selection
				currentSelection.endNode = newElement.firstChild ? newElement.firstChild : newElement;
				currentSelection.endElement = newElement;
			}
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
			setListLevel(targetNode, newAdjustedLevel);
			return true;
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

// assumes updateSelection() valid before calling
function DoTab() {
	if (isSelection()) { // selection => demote
		recountHandled = true;
		demoteSelectedNodes();
		countChildWords();
		return true;
	} else if (currentSelection.startElement && currentSelection.startElement.classList) {
		if (currentSelection.startOffset === 0) { // single element, but we're at the beginning => demote
			const currentNodeLevel = getOrCalculateNodeLevel(currentSelection.startElement);
			if (currentNodeLevel && currentNodeLevel >= pLevel) {
				// indenting at the beginning? that's list-making
				setListLevel(currentSelection.startElement, currentNodeLevel - pLevel + 1);
				return true;
			}
		}
		// TODO: else, make columns / tables
	}
	return false;
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
	return setShowingLevel(Math.max(showingLevel - 1, 0));
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
			currentNode.classList.remove("focusedParent");
		} else {
			currentNode.classList.add("focusedParent");
		}
	}

	return changedLevel;
}

function moveUpSimple() {
	recountHandled = true;
	updateSelection();
	const beforeExpansion = copyCurrentSelection();
	expandSelectionToIncludeHiddenChildren();
	if (currentSelection.startElement) {
		const previousElement = previousVisibleOrderableSibling(currentSelection.startElement).sibling;
		if (previousElement) {
			previousElement.before(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection();
			return true;
		} else if (currentSelection.startElement !== userDoc.firstChild) {
			// insert at beginning
			userDoc.prepend(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection();
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
	if (currentSelection.endElement) {
		const nextElement = thisOrLastHiddenChild(nextVisibleOrderableSibling(currentSelection.endElement).sibling);
		if (nextElement) {
			nextElement.after(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection();
			return true;
		} else if (currentSelection.endElement !== userDoc.lastChild) {
			// insert at end
			userDoc.append(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection();
			return true;
		} else {
			setCurrentSelection(beforeExpansion);
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
			restoreSelection();
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
				restoreSelection();
				return true;
			} else if (currentSelection.endElement !== userDoc.lastChild) {
				// insert at end
				userDoc.append(...selectedNodes());
				countChildWords();
				setCurrentSelection(beforeExpansion);
				restoreSelection();
				return true;
			} else {
				setCurrentSelection(beforeExpansion);
			}
		}  else if (currentSelection.endElement !== userDoc.lastChild) {
			// insert at end
			userDoc.append(...selectedNodes());
			countChildWords();
			setCurrentSelection(beforeExpansion);
			restoreSelection();
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
				targetNode.classList.add("activeSection");
			}
		}
	}

	if (event.altKey) {
		if (event.shiftKey) {
			// Navigate shortcuts
			if (arrowUpPressed) {
				event.preventDefault();
				if (isSingleElementSelection()) {
					moveUpSection();
				}
			} else if (arrowDownPressed) {
				event.preventDefault();
				if (isSingleElementSelection()) {
					moveDownSection();
				}
			} else if (arrowLeftPressed) {
				//if (increaseShowingLevel()) {
				//	
				//}
			} else if (arrowRightPressed) {
				//if (decreaseShowingLevel()) {
				//	
				//}
			}
		} else {
			// Move shortcuts
			if (arrowUpPressed) {
				event.preventDefault();
				moveUpSimple();
			} else if (arrowDownPressed) {
				event.preventDefault();
				moveDownSimple();
			} else if (arrowLeftPressed) { // Promote/Adjust
				event.preventDefault();
				recountHandled = true;
				updateSelection();
				promoteSelectedNodes();
				countChildWords();
			} else if (arrowRightPressed) { // Demote/Adjust
				event.preventDefault();
				recountHandled = true;
				updateSelection();
				demoteSelectedNodes();
				countChildWords();
			} else if (event.key === "h") { // Hide/Unhide
				// work from end to beginning of selection, toggling hidden status
				event.preventDefault();
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
			} else if (event.key === "Backspace") {
				event.preventDefault();
				updateSelection();
				expandSelectionToIncludeHiddenChildren();
				let targetNode;
				for (targetNode of selectedNodes()) {
					targetNode.remove();
				}
				// no need to restore previous selection, because that's goooone now, but let's reflect new selection:
				// TODO: Probably not actually needed. The problem is the empty text is what's selected after delete.
				// Fix that and then this will probably work automatically due to selection change.
				//updateSelection();
				//addParagraphHighlights();
			}

		}
	} else if (event.ctrlKey) {
		if (event.key === "z") { // Undo (TODO)
			event.preventDefault();
		}
	} else {
		if (event.key === "Tab") {
			updateSelection();
			if (DoTab()) {
				event.preventDefault();
			}
		} else if (event.key === " ") { // space at beginning does "tab"
			updateSelection();
			if (!isSelection() && currentSelection.endNode) {
				if (currentSelection.startOffset === 0) {
					if (DoTab()) {
						event.preventDefault();
					}
				}
			}
		} else if (event.key === "Backspace") {
			const targetNode = updateSelection();
			if (!isSelection() && targetNode && targetNode.classList && currentSelection.startOffset === 0) {
				const currentNodeLevel = getOrCalculateNodeLevel(targetNode);
				if (currentNodeLevel && currentNodeLevel > pLevel) {
					event.preventDefault();
					// promote by one
					setListLevel(targetNode, currentNodeLevel - pLevel - 1);
					return;
				}
			}
		} else if (event.key === "Enter") {
			const targetNode = updateSelection();
			if (targetNode && targetNode.classList) {
				if (currentSelection.startOffset === 0) {
					const currentNodeLevel = getOrCalculateNodeLevel(targetNode);
					if (currentNodeLevel && currentNodeLevel > pLevel) {
						// promote all the way
						setListLevel(targetNode, 0);
						event.preventDefault();
						return;
					}
				}
				let needsToClear = true;
				if (targetNode instanceof HTMLHeadingElement) {
					if (!isSelection() && currentSelection.endOffset === currentSelection.endNode.textContent.length) {
						needsToClear = false;
						event.preventDefault();
						//if (currentSelection.type === "Range") {
						//	currentSelection.deleteFromDocument();
						//	if (currentSelectionStartOffset === 0) {
						//		currentSelectionStartElement.appendChild(document.createElement("br"));
						//	}
						//	// TODO:
						//	// 1. Make it handle deleting everything between start and end node -- including hidden stuff.
						//	// 2. Refactor to its own function so I can use this on ANY typing when something's already selected, or DEL or BACKSPACE or CUT...
						//	//      ... But NOT the "br" bit up there, which only applies here because we're starting a new paragraph. Needs preserving here.
						//}
						// New paragraph
						const newParagraph = document.createElement("p");
						newParagraph.classList.add("paragraph");
						newParagraph.appendChild(document.createElement("br"));
						targetNode.after(newParagraph);
						const newRange = document.createRange();
						newRange.setStart(newParagraph, 0);
						const newSelection = document.getSelection();
						newSelection.removeAllRanges();
						newSelection.addRange(newRange);
					} else {
						clearNodeWordCounters(targetNode);
					}
				}
				if (needsToClear) {
					// wait, watch-out -- this node might get split! clear counters!
					clearNodeWordCounters(targetNode);
				}
			}
		}
	}
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
				targetNode.classList.remove("activeSection");
			}
		}
	}
}

function clearParagraphHighlights() {
	let numNodesCleared = 0;
	let currentNode;
	for (currentNode of selectedElements()) {
		currentNode.classList.remove("activeParagraph");
		numNodesCleared++;
	}
	if (isSingleElementSelection() && currentSelection.startElement) {
		for (targetNode of childElementsOf(currentSelection.startElement)) {
			targetNode.classList.remove("activeSection");
		}
	}
	return numNodesCleared;
}

function addParagraphHighlights() {
	let currentNode;
	for (currentNode of selectedElements()) {
		currentNode.classList.add("activeParagraph");
	}
	if (isSingleElementSelection() && shiftPressed && altPressed && currentSelection.startElement) {
		for (targetNode of childElementsOf(currentSelection.startElement)) {
			targetNode.classList.add("activeSection");
		}
	}
}

function selectionChange(event) {
	// this happens after EVERY change, so it could be useful for:
	//	- detecting meaningful changes
	// 	- sanitising pasted content
	//	- updating undo/redo stack

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

		// clear current highlights
		clearParagraphHighlights();

		// update current selection
		updateSelection();
		const startChanged = previousSelectionStartElement !== currentSelection.startElement;
		const endChanged = previousSelectionEndElement !== currentSelection.endElement;
		
		let nodeForDelta = null;
		let nodeDelta = 0;
		let bigChange = false;
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

tableOfContents.addEventListener("keydown", inputOverrides);
tableOfContents.addEventListener("keyup", keyRelease);

userDoc.addEventListener("keydown", inputOverrides);
userDoc.addEventListener("keyup", keyRelease);
userDoc.addEventListener("paste", pasting);

document.addEventListener("selectionchange", selectionChange);