window.addEventListener("load",fractalGenPageInit);

let ctx = null;  // canvas 2D context
let palette = null;
let altPalette = null;
let canvasHasListener = false;

const ASPECTRATIO = 0.75;
const MINPIXWID = 120;
const MAXPIXWID = 800;

const limElem = elemFromId("lim");
const zoomElem = elemFromId("zoom");
const pixWidElem = elemFromId("pixwid");
const ditherElem = elemFromId("dither");
const paletteSizeElem = elemFromId("palettesize");
const paletteOffsElem = elemFromId("paletteoffset");
const redrawButton = elemFromId("redrawbutton");
const resetButton = elemFromId("resetbutton");
const directButton = elemFromId("directbutton");
const histSelElem = elemFromId("histopt");
const canvas = elemFromId("fractalcanvas");
const dirEntryDiv = elemFromId("dirform");
const directCtrXelem = elemFromId("dirreal");
const directCtrYelem = elemFromId("dirimagine");
const directWidElem = elemFromId("dirwid");
const directLimElem = elemFromId("dirlim");
const directJSONinput = elemFromId("dirjson");
const directJSONbutton = elemFromId("dirjsonbutton");
const dirDoitButton = elemFromId("dirdo");
const dirCancelButton = elemFromId("dircancel");
const histViewElem = elemFromId("histview");

let mGrid = null;

const imgParams = {}; // object containing all parameters (other than
                      // palette) needed to calculate image data

let imgHistory = [];  // array of imgParams instances

function elemFromId(id) {
    // convenience function
    return document.getElementById(id);
}

function checkRequiredElements() {
    const checkList = [
        [limElem ,"lim"],
        [zoomElem ,"zoom"],
        [pixWidElem ,"pixwid"],
        [ditherElem ,"dither"],
        [paletteSizeElem ,"palettesize"],
        [paletteOffsElem ,"paletteoffset"],
        [redrawButton ,"redrawbutton"],
        [resetButton ,"resetbutton"],
        [directButton, "directbutton"],
        [dirEntryDiv, "dirform"],
        [histSelElem ,"histopt"],
        [canvas ,"fractalcanvas"],
        [histViewElem ,"histview"],
        [directCtrXelem,"dirreal"],
        [directCtrYelem,"dirimagine"],
        [directWidElem,"dirwid"],
        [directLimElem,"dirlim"],
        [directJSONinput,"dirjson"],
        [directJSONbutton,"dirjsonbutton"],
        [dirDoitButton,"dirdo"],
        [dirCancelButton,"dircancel"]
    ];
    let allGood = true;
    checkList.forEach((item)=>{
        let fnc = item[0];
        let id = item[1];
        if (!fnc) {
            console.error('required element "' + id + '" not present');
            allGood = false;
        }
    });
    if (!allGood) {
        console.error('one or more required elements missing');
        throw "one or more required elements missing";
    }
}

function setPageInitVals() {
    limElem.value = 70;
    zoomElem.value = "2.0";
    pixWidElem.value = dimensionsFromWindowSize().width;
    ditherElem.value = "2";
    paletteSizeElem.value = 256;
    paletteOffsElem.value = 0;
    histSelElem.value = "last";
}

function initCanvasOnly(wid,hgt) {
    // Initialize the canvas in the DOM and set the corresponding
    // context (ctx) but do not draw the Mandelbrot image on it.
    ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error('unable to obtain 2d context from canvas ' + id);
        return;
    }
    ctx.fillStyle = "#000000";  // black
    if ((wid)&&(hgt)) {
        // If BOTH dimensions are provided as parameters then use these
        // to set the canvas dimensions
        canvas.width = wid;
        canvas.height = hgt;
    } else {
        // Otherwise, get canvas dimensions calculated based on window size.
        const canvasDims = dimensionsFromWindowSize();
        canvas.width = canvasDims.width;
        canvas.height = canvasDims.height;
        if (pixWidElem) {
            // Set the value shown in the input box to match
            // the width of the canvas.
            pixWidElem.value = canvas.width;
        }
    }
    // Draw initial opaque black background
    ctx.fillRect(0,0,canvas.width,canvas.height);
}

function dimensionsFromWindowSize() {
    const dims = {};
    // Width is 80% of window width, but not less than MINPIXWID nor more than MAXPIXWID.
    dims.width = Math.round(Math.max(MINPIXWID,Math.min(MAXPIXWID,window.innerWidth*0.8)));
    // Height set from width so that aspect ratio stays constant
    dims.height = Math.round(dims.width*ASPECTRATIO);
    return dims;
}

function fractalGenPageInit() {
    // Initializes the DOM and draws Mandelbrot image using initial
    // default parameters.
    imgHistory = [];  // Start with empty history of images
    checkRequiredElements();
    initCanvasOnly(); // Initialize the HTML canvas element that will contain the Mandelbrot image
    redrawButton.addEventListener("click",()=>{
        const lim = parseInt(limElem.value);
        drawMandelbrot(imgParams.xMin,imgParams.yMin,imgParams.realWidth,lim);
    });
    directButton.addEventListener("click",()=>{
        dirEntryDiv.style.display = "block";
    });
    dirCancelButton.addEventListener("click",()=>{
        dirEntryDiv.style.display = "none";
    });
    dirDoitButton.addEventListener("click",()=>{
        const ctrX = parseFloat(directCtrXelem.value);
        const ctrY = parseFloat(directCtrYelem.value);
        const realWid = parseFloat(directWidElem.value);
        const lim = parseInt(directLimElem.value);
        console.log('ctr, wid, lim = ', ctrX, ctrY, realWid, lim);
        const xMin = ctrX - realWid/2;
        const yMin = ctrY - realWid*ASPECTRATIO/2;
        console.log('dir mins = ', xMin, yMin);
        dirEntryDiv.style.display = "none";
        drawMandelbrot(xMin,yMin,realWid,lim);
        limElem.value = lim;
    });
    directJSONbutton.addEventListener("click",()=>{
        try {
            const rawJson = directJSONinput.value;
            let jsonFine = rawJson.trim().toLowerCase();
            if (!jsonFine.startsWith("{")) {
                jsonFine = "{" + jsonFine;
            }
            if (!jsonFine.endsWith("}")) {
                jsonFine += "}";
            }
            const obj = JSON.parse(jsonFine);
            const { center, width, limit } = obj;
            if (!center || !width || !limit) {
                throw "required JSON element ('center','width', or 'limit') missing";
            }
            const xMin = center[0]-width/2;
            const yMin = center[1]-width*ASPECTRATIO/2;
            dirEntryDiv.style.display = "none";
            drawMandelbrot(xMin,yMin,width,limit);
            limElem.value = limit;
        } catch (err) {
            alert('Error processing JSON content - not used');
            console.error(err, rawJson);
            return;
        }
    });
    setPageInitVals();  // Set initial default input values on page
    resetButton.addEventListener("click",fractalGenPageInit);
    directButton.addEventListener("click",promptForDirectEntry);
    histSelElem.addEventListener("change",renderHistory);
    paletteSizeElem.addEventListener("change",handlePaletteChange);
    paletteOffsElem.addEventListener("change",handlePaletteChange);
    handlePaletteChange();
    setTimeout(()=>drawMandelbrot(-2.3,-1.2,3.2,70),100);
}

function handlePaletteChange() {
    // Called when either "palettesize" or "paletteoffset" inputs change.
    // If and only if change values are value then canvas image is redrawn
    // with the altered palette, and this is done without recalculating the
    // underlying Mandelbrot counts - i.e. no call to getMandelbrotGrid().
    try {
        let paletteSize = parseInt(paletteSizeElem.value);
        let paletteOffset = parseFloat(paletteOffsElem.value);
        if (typeof paletteSize !== 'number') {
            return;
        }
        if (Number.isNaN(paletteSize)) {
            return;
        }
        if (typeof paletteOffset !== 'number') {
            return;
        }
        if (Number.isNaN(paletteOffset)) {
            return;
        }
        setPalette(paletteSize,paletteOffset,(paletteSize%2===0));
        if (mGrid) {
            paintGridToCanvas(mGrid,imgParams,true);
        }    
    } catch (err) {
        console.error ('error parsing palette info', paletteSize, ' ', paletteOffset);
        return;
    }
}

function promptForDirectEntry() {
    console.log('prompting for direct entry');  // TODO
    console.log('finished prompting for direct entry');  // TODO
}

function drawMandelbrot(xMin,yMin,realWidth,limit) {
    // Draws Mandelbrot Set on canvas element based on
    // coordinates (real and imaginary) of lower-left corner of 
    // image, width of selected section (along real axis), and a count
    // limit.  (Note that height is inferred from realWidth in based on
    // aspect ration.)
    // 
    // Steps in processing are: (1) set values in 'imgParams' object,
    // (2) get counts for each pixel via getMandelbrotGrid(), (3) paint
    // the results to the canvas by converting each pixels set of counts
    // to a color based on the currently active palette (paintGridToCanvas()),
    // (4) append a clone of imgParams to the cumulative history (imgHistory)
    // of rendered Mandelbrot images, and (5) display none, some, or all of that
    // history on the page (renderHistory()).
    checkForPixWidChange();
    imgParams.limit = limit;
    imgParams.canvWidth = canvas.width;
    imgParams.canvHeight = canvas.height;
    imgParams.realWidth = realWidth;
    imgParams.xMin = xMin;
    imgParams.xMax = xMin + realWidth;
    imgParams.incrPerPixel = realWidth/(imgParams.canvWidth-1);
    imgParams.yMin = yMin;
    imgParams.yMax = yMin + (imgParams.canvHeight-1)*imgParams.incrPerPixel;
    imgParams.xCtr = (imgParams.xMin+imgParams.xMax)/2;
    imgParams.yCtr = (imgParams.yMin+imgParams.yMax)/2;
    imgParams.dither = getDitherValue();
    imgParams.subIncr = imgParams.incrPerPixel/imgParams.dither;
    imgParams.subIncrBase = -imgParams.subIncr*(imgParams.dither-1)/2;
    redrawButton.disabled = true;
    redrawButton.className = "buttnnotavail";
    mGrid = getMandelbrotGrid(imgParams);
    paintGridToCanvas(mGrid,imgParams,true);
    const imgParamsClone = Object.assign({},imgParams);  // shallow clone of imgParams
    imgHistory.push(imgParamsClone);
    renderHistory();
    if (!canvasHasListener) {
        addCanvasListener();
    }
    redrawButton.disabled = false;
    redrawButton.className = "buttnavail";
}

function getMandelbrotGrid(imgp) {
    let mGrid = {};
    mGrid.countsHistogram = new Array(imgp.limit+1).fill(0);
    mGrid.width = imgp.canvWidth;
    mGrid.height = imgp.canvHeight;
    mGrid.countsForPixel = [];
    let pixelNum = -1;
    for (let j=0;j<imgp.canvHeight;j++) {
        let y = imgp.yMax-imgp.incrPerPixel*j;
        for (let i=0;i<imgp.canvWidth;i++) {
            pixelNum++;
            let x = imgp.xMin+imgp.incrPerPixel*i;
            let localCountArray = [];
            for (let ii=0;ii<imgp.dither;ii++) {
                for (let jj=0;jj<imgp.dither;jj++) {
                    const count = mandelbrot(x+imgp.subIncrBase+ii*imgp.subIncr,
                        y+imgp.subIncrBase+jj*imgp.subIncr,imgp.limit);
                    if (count < 0 || count > imgp.limit) {
                        console.error('count ' + count + ' outside of range');
                    } else {
                        mGrid.countsHistogram[count]++;
                        localCountArray.push(count);
                    }
                }
            }
            mGrid.countsForPixel[pixelNum] = localCountArray;
        }
    }
    return mGrid;
}

function paintGridToCanvas(mGrid,imgp,useStandardPalette) {
    const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
    const imgDataData = imgData.data;
    const m2 = imgp.dither**(-2);
    let gridIdx = 0;
    for (let j=0;j<imgp.canvHeight;j++) {
        let rowOffset = j*imgp.canvWidth*4;
        let pixelOffset = rowOffset;
        for (let i=0;i<imgp.canvWidth;i++) {
            const avgColor = [0,0,0];
            const localCounts = mGrid.countsForPixel[gridIdx];
            localCounts.forEach((count)=>{
                const color = colorFromCount(count, imgp.limit, useStandardPalette);
                avgColor.forEach((d,idx)=>avgColor[idx]+=color[idx]);
            })
            avgColor.forEach((val,idx)=>avgColor[idx]=Math.round(val*m2));
            avgColor.forEach((val,idx)=>imgDataData[pixelOffset+idx]=val);
            imgDataData[pixelOffset+3] = 255;
            pixelOffset+=4;
            gridIdx++;
        }
    }
    imgData.data = imgDataData;
    ctx.putImageData(imgData,0,0);
}

function getDitherValue() {
    try {
        val = parseInt(ditherElem.value);
        if (Number.isNaN(val) || val < 1 || val > 5) {
            console.error('invalid dither selection = ', val);
            throw ('invalid dither selection');
        }
        return val;
    } catch (err) {
        console.error('error obtaining dither value - using default (2); err = ', err);
        return 2;
    }
}

function addCanvasListener() {
    canvas.addEventListener("click",(event)=>handleCanvasClick(event));
    canvasHasListener = true;
}

function handleCanvasClick(event) {
    let zoomFactor = 2.0;
    if (zoomElem) {
        const zoomValueStr = zoomElem.value.trim();
        let zoomValue = null;
        try {
            zoomValue = parseFloat(zoomValueStr);
            if (zoomValue > 0) {
                zoomFactor = zoomValue;
            } else {
                console.error('negative reduction factor - using 2.0');
            }
        } catch (err) {
            console.error('error parsing reduction factor - using 2.0, err = ', err);
        }
    }
    const i = event.offsetX;
    const j = event.offsetY;
    const newCtrX = imgParams.xMin + imgParams.incrPerPixel*i;
    const newCtrY = imgParams.yMax - imgParams.incrPerPixel*j;
    const newRealWidth = imgParams.realWidth/zoomFactor;
    const newXmin = newCtrX - newRealWidth/2;
    const newYmin = newCtrY - newRealWidth*(imgParams.canvHeight/imgParams.canvWidth)/2;
    let newLimit = null;
    if (limElem) {
        newLimit = parseInt(limElem.value);
    } else {
        newLimit = imgParam.limit + 10;
    }
    drawMandelbrot(newXmin, newYmin, newRealWidth, newLimit);
    if (limElem) {
        limElem.value = newLimit;
    }
}

function mandelbrot(x, y, limit) {
    let u = x;
    let v = y;
    const limR2 = 12;
    let r2 = 0;
    let count = -1;
    while (count < limit && r2 < limR2) {
        const u2 = u*u;
        const v2 = v*v;
        const newU = u2 - v2 + x;
        v = 2*u*v + y;
        u = newU;
        r2 = u2 + v2;
        count++;
    }
    return count;
}

function colorFromCount(count, limit, useStandard) {
    // Returns an array representing a color.  See setPalette() for
    // a more detailed explanation.
    if (count >= limit) {
        return [0,0,0];  // black - default value for exceeded limit
    } else {
        if (!palette) {
            setPalette();
        }
        if (useStandard) {
            return palette[(Math.floor(count)%(palette.length))];
        } else {
            return altPalette[(Math.floor(count)%(altPalette.length))];
        }
    }
}

function setPalette(size,offset,doToggle) {
    // Sets the global 'palette' variable to be an array of 256 (for now) 
    // 'colors'; however, these colors are actually nested arrays each having
    // three integer values.  These values could later be converted to
    // proper #RRGGBB format HTML colors if so desired but, for the purposes
    // of functions using 'palette', this format is more convenient and enables
    // greater flexibility in making use of these colors - particularly with
    // respect to further mathematical manipulation of the primary values
    // when desired.
    palette = [];
    altPalette = [];
    const PHASEMX = 360;
    if (size) {
        size = Math.max(size,2);
        size = Math.min(size,32768);
    } else {
        size = 256;  // default
    }
    if (offset) {
        offset = Math.max(-PHASEMX,offset);
        offset = Math.min(PHASEMX,offset);
        offset*=Math.PI/180;
    } else {
        offset = 0;
    }
    if (doToggle == null || typeof doToggle != 'boolean') {
        doToggle = true;
    }
    for (let i=0;i<size;i++) {
        const theta = i*2*Math.PI/size;
        let c = colorOfAngle(theta+offset, true);
        if (doToggle && i%2===0) {
            c = c.map((val)=>Math.round(val*0.93));
        }
        palette.push(c);
        let c2 = colorOfAngle(theta, false);
        altPalette.push(c2);
    }
    function colorOfAngle(th, useStandard) {
        // Returns an array of three primary color values, each of
        // which is an integer from 0 to 255.  These returned
        // arrays can be used to determine a corresponding
        // HTML color value (e.g. "#RRGGBB").
        let colr = [];
        for (let i=2;i>=0;i--) {
            if (useStandard) {
                colr.push(hexCol(th+i, false));
            } else {
                colr.push(hexCol(th, true));
            }
        }
        return colr;
        //
        function hexCol(th, isMuted) {
            // Returns a primary color value (an integer in the range
            // from 0 to 255) based on the ("theta") an angle somewhat
            // akin to a hue value
            let val = (Math.cos(th)+1)/2;
            if (isMuted) {
                val = val*0.3+0.35;
            }
            val = Math.floor(val*256);
            val = Math.max(0,Math.min(255,val));
            return val;
        }
    }
}

function checkForPixWidChange(event) {
    const saveWidth = imgParams.canvWidth;
    const newWidStr = pixWidElem.value.trim();
    try {
        const newWid = parseInt(newWidStr);
        if (typeof newWid == 'number' && !Number.isNaN(newWid) && newWid > 3) {
            const newHgt = Math.round(newWid*ASPECTRATIO);
            if (newWid !== saveWidth) {
                pixWidElem.value = newWid;
                initCanvasOnly(newWid,newHgt);
            }
        } else {
            throw ('invalid or nonnumeric entry for pixel width');
        }
    } catch (err) {
        console.error('ignoring pixel width change error = ', err);
        setTimeout(()=>{
            pixWidElem.value = saveWidth;  // On error, restore to canvas dimension
        },1500 /* 1.5 seconds */ );
        pixWidElem.classList.add("warninput");
        setTimeout(()=>{
            pixWidElem.classList.remove("warninput");
        },3000 /* 3 seconds */ );
    }
}

function renderHistory() {
    let histTable = document.querySelector("#histview table");
    if (histTable) {
        histTable.remove();
    }
    if (imgHistory.length < 1) {
        // Nothing to render regardless of option
        return;
    }
    const option = getHistoryOption();
    if (option === "none") {
        return;
    }
    histTable = document.createElement("table");
    const tHeadElem = document.createElement("thead");
    const trElem = document.createElement("tr");
    const hdrs = ("#;Center Point;Width;Limit;Pixel Dimensions;Quality").split(";");
    hdrs.forEach((val,idx)=>{
        const thElem = document.createElement("th");
        thElem.textContent = val;
        if (idx !== 1) {
            thElem.setAttribute("align","center");
        }
        trElem.appendChild(thElem);
    });
    tHeadElem.appendChild(trElem);
    histTable.appendChild(tHeadElem);
    const lastIdx = imgHistory.length-1;
    let firstIdx = 0;
    if (option === "all") {
        firstIdx = 0;
    } else if (option === "ten") {
        firstIdx = Math.max(0,lastIdx-9);
    } else {  // includes anticipated value "last" as well as defaulting to the same
        // behavior as "last" if other unanticipated values are encountered.
        firstIdx = lastIdx;
    }
    const tBodyElem = document.createElement("tbody");
    let rowElem = null;
    for (let row=firstIdx;row<=lastIdx;row++) {
        const histRow = imgHistory[row];
        rowElem = document.createElement("tr");
        const { xCtrScaled, yCtrScaled, widthScaled } = scaledValues(histRow);
        const yIsNegative = (yCtrScaled < 0);
        pushCell(row+1,"right","javascript:reDrawImg("+row+")");
        pushCell(xCtrScaled + (yIsNegative?" - ":" + ") + Math.abs(yCtrScaled) + "i","center");
        pushCell(widthScaled);
        pushCell(histRow.limit,"center");
        pushCell(histRow.canvWidth + " x " + histRow.canvHeight,"center");
        pushCell(histRow.dither,"center");
        tBodyElem.appendChild(rowElem);
    }
    histTable.appendChild(tBodyElem);
    histViewElem.appendChild(histTable);
    //
    function pushCell(cellContent,alignment,href) {
        const td = document.createElement("td");
        if (href) {
            const aElem = document.createElement("a");
            aElem.textContent = cellContent;
            aElem.setAttribute("href",href);
            td.appendChild(aElem);
        } else {
            td.textContent = cellContent;
        }
        if (alignment) {
            td.setAttribute("align",alignment);
        }
        rowElem.appendChild(td);
    }
    //
    function scaledValues(rowElem) {
        const { xCtr, yCtr, realWidth, canvWidth } = rowElem;
        const pixPrecision = realWidth/canvWidth;
        const postDecimal = Math.round(Math.max(-Math.log10(pixPrecision),0))+2;
        return {
            xCtrScaled : scaleTo(xCtr,postDecimal),
            yCtrScaled : scaleTo(yCtr,postDecimal),
            widthScaled : scaleTo(realWidth,postDecimal)
        };
        //
        function scaleTo(val,decShift) {
            const k = 10**decShift;
            return Math.round(val*k)/k;
        }
    }
}

function reDrawImg(imgNo) {
    parmLoc = imgHistory[imgNo];
    pixWidElem.value = parmLoc.canvWidth;
    drawMandelbrot(parmLoc.xMin,parmLoc.yMin,parmLoc.realWidth,parmLoc.limit);
}

function getHistoryOption() {
    if (!histSelElem) {
        return "last";
    }
    const val = histSelElem.value;
    if (!val) {
        return "last;"
    }
    if (["none","last","ten","all"].includes(val)) {  // Restrict to anticipated values
        return val
    } else {
        return "last";  // otherwise, default to last
    }
}