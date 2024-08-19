window.addEventListener("load",fractalGenPageInit);

let canvas = null;
let ctx = null;  // canvas 2D context
let palette = null;
let altPalette = null;
let canvasHasListener = false;
let pixWidthInput = null;

let histSelElem = null;

const ASPECTRATIO = 0.75;
const MINPIXWID = 120;
const MAXPIXWID = 800;

let mGrid = null;

const imgParams = {}; // object containing all parameters (other than
                      // palette) needed to calculate image data

let imgHistory = [];  // array of imgParams instances

function initCanvasOnly(wid,hgt) {
    // Initialize the canvas in the DOM and set the corresponding
    // context (ctx) but do not draw the Mandelbrot image on it.
    const id = "fractalcanvas";
    canvas = document.getElementById(id);
    if (!canvas) {
        console.error('no ' + id + ' id on page');
        return;
    }
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
        const pixWidElem = document.getElementById("pixwid");
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
    initCanvasOnly(); // Initialize the HTML canvas element that will contain the Mandelbrot image
    const drawButton = document.getElementById("redrawbutton");
    if (drawButton) {
        drawButton.addEventListener("click",()=>{
            const lim = parseInt((document.getElementById("lim")).value);
            drawMandelbrot(imgParams.xMin,imgParams.yMin,imgParams.realWidth,lim);
        });
    }
    const resetButton = document.getElementById("resetbutton");
    if (resetButton) {
        setPageInitVals();  // Set initial default input values on page
        resetButton.addEventListener("click",fractalGenPageInit);
    }
    pixWidthInput = document.getElementById("pixwid");
    if (pixWidthInput) {
        pixWidthInput.addEventListener("change",(event)=>handlePixWidChange(event));
    } else {
        console.error('no pixwid id found - resizing disabled');
    }
    histSelElem = document.getElementById("histopt");
    if (histSelElem) {
        histSelElem.addEventListener("change",renderHistory);
    }
    (document.getElementById("palettesize")).addEventListener("change",handlePaletteChange);
    (document.getElementById("paletteoffset")).addEventListener("change",handlePaletteChange);
    handlePaletteChange();
    setTimeout(()=>drawMandelbrot(-2.3,-1.2,3.2,70),100);
}

function handlePaletteChange() {
    // Called when either "palettesize" or "paletteoffset" inputs change.
    // If and only if change values are value then canvas image is redrawn
    // with the altered palette, and this is done without recalculating the
    // underlying Mandelbrot counts - i.e. no call to getMandelbrotGrid().
    try {
        let paletteSize = parseInt((document.getElementById("palettesize")).value);
        let paletteOffset = parseFloat((document.getElementById("paletteoffset")).value);
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

function setPageInitVals() {
    // Sets initial default values for various input elements
    setVal("lim",70);
    setVal("zoom","2.0");
    setVal("dither","2");
    setVal("histopt","last");
    setVal("pixwid",(dimensionsFromWindowSize()).width);
    setVal("palettesize",256);
    setVal("paletteoffset",0);
    //
    function setVal(id,val) {
        // Sets the value of an input element after looking it up
        // based in 'id'
        try {
            (document.getElementById(id)).value = val;
        } catch (err) {
            // Log errors but otherwise ignore so that subsequent 
            // settings can still proceed without interrupting use.
            console.error('err on page init - ignoring: err = ', err);
        }
    }
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
    const button = document.getElementById("redrawbutton");
    button.disabled = true;
    button.className = "buttnnotavail";
    mGrid = getMandelbrotGrid(imgParams);
    paintGridToCanvas(mGrid,imgParams,true);
    const imgParamsClone = Object.assign({},imgParams);  // shallow clone of imgParams
    imgHistory.push(imgParamsClone);
    renderHistory();
    if (!canvasHasListener) {
        addCanvasListener();
    }
    button.disabled = false;
    button.className = "buttnavail";
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
    // TODO - maybe check imgp dimensions against mGrid dimensions here?
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
        const ditherElem = document.getElementById("dither");
        if (!ditherElem) {
            throw 'no dither element found';
        }
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
    let zoomElem = document.getElementById("zoom");
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
    const limElem = document.getElementById("lim");
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

function handlePixWidChange(event) {
    const saveWidth = imgParams.canvWidth;
    const newWidStr = pixWidthInput.value.trim();
    try {
        const newWid = parseInt(newWidStr);
        if (typeof newWid == 'number' && !Number.isNaN(newWid) && newWid > 3) {
            const newHgt = Math.round(newWid*ASPECTRATIO);
            if (newWid !== saveWidth) {
                pixWidthInput.value = newWid;
                initCanvasOnly(newWid,newHgt);
                drawMandelbrot(imgParams.xMin,imgParams.yMin,imgParams.realWidth,imgParams.limit);
            }
        } else {
            throw ('invalid or nonnumeric entry for pixel width');
        }
    } catch (err) {
        console.error('ignoring pixel width change error = ', err);
        setTimeout(()=>{
            pixWidthInput.value = saveWidth;  // On error, restore to canvas dimension
        },1500 /* 1.5 seconds */ );
        pixWidthInput.classList.add("warninput");
        setTimeout(()=>{
            pixWidthInput.classList.remove("warninput");
        },3000 /* 3 seconds */ );
    }
}

function renderHistory() {
    const histViewElem = document.getElementById("histview");
    if (!histViewElem) {
        console.error('no histview id on page');
        return;
    }
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
        pushCell(row+1,"right");
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
    function pushCell(cellContent,alignment) {
        const td = document.createElement("td");
        td.textContent = cellContent;
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