window.addEventListener("load",fractalGenPageInit);

let canvas = null;
let ctx = null;  // canvas 2D context
let palette = null;
let canvasHasListener = false;
let pixWidthInput = null;

const ASPECTRATIO = 0.75;
const MINPIXWID = 120;
const MAXPIXWID = 800;

let imgParams = {};

let imgHistory = [];

function initCanvasOnly(wid,hgt) {
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
    ctx.fillStyle = "#000000";
    if ((wid)&&(hgt)) {
        canvas.width = wid;
        canvas.height = hgt;
    } else {
        canvas.width = Math.round(Math.max(MINPIXWID,Math.min(MAXPIXWID,window.screen.availWidth*0.8)));
        canvas.height = Math.round(canvas.width*ASPECTRATIO);
        const pixWidElem = document.getElementById("pixwid");
        if (pixWidElem) {
            pixWidElem.value = canvas.width;
        }
    }
    // If wid and hgt parameters are not provided then default to pre-existing
    // canvas dimensions, presumably as specified in the HTML
    ctx.fillRect(0,0,(wid?wid:canvas.width),(hgt?hgt:canvas.height));
}

function fractalGenPageInit() {
    imgHistory = [];
    initCanvasOnly();
    let drawButton = document.getElementById("redrawbutton");
    if (drawButton) {
        drawButton.addEventListener("click",()=>{
            let lim = parseInt((document.getElementById("lim")).value);
            drawMandelbrot(imgParams.xMin,imgParams.yMin,imgParams.realWidth,lim);
        });
    }
    let resetButton = document.getElementById("resetbutton");
    if (resetButton) {
        resetButton.addEventListener("click",fractalGenPageInit);
    }
    pixWidthInput = document.getElementById("pixwid");
    if (pixWidthInput) {
        pixWidthInput.addEventListener("change",(event)=>handlePixWidChange(event));
    } else {
        console.error('no pixwid id found - resizing disabled');
    }
    setTimeout(()=>drawMandelbrot(-2.3,-1.2,3.2,70),100);
}

function drawMandelbrot(xMin,yMin,realWidth,limit) {
    imgParams.limit = limit;
    imgParams.canvWidth = canvas.width;
    imgParams.canvHeight = canvas.height;
    imgParams.realWidth = realWidth;
    imgParams.xMin = xMin;
    imgParams.xMax = xMin + realWidth;
    imgParams.incrPerPixel = realWidth/(imgParams.canvWidth-1);
    imgParams.yMin = yMin;
    imgParams.yMax = yMin + (imgParams.canvHeight-1)*imgParams.incrPerPixel;
    imgParams.dither = getDitherValue();
    imgParams.subIncr = imgParams.incrPerPixel/imgParams.dither;
    imgParams.subIncrBase = -imgParams.subIncr*(imgParams.dither-1)/2;
    const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
    const imgDataData = imgData.data;
    let m2 = imgParams.dither**(-2);
    let button = document.getElementById("redrawbutton");
    button.disabled = true;
    button.className = "buttnnotavail";
    for (let j=0;j<imgParams.canvHeight;j++) {
        let y = imgParams.yMax-imgParams.incrPerPixel*j;
            // Note subtraction above.  This 
            // introduces the standard Cartesian coordinate
            // orientation where y values increase from bottom to top,
            // despite the opposing HTML convention.  
        let rowOffset = j*imgParams.canvWidth*4;
        let pixelOffset = rowOffset-4;  // Note the -4 is deliberate
        for (let i=0;i<imgParams.canvWidth;i++) {
            let x = imgParams.xMin+imgParams.incrPerPixel*i;
            pixelOffset+=4;
            let avgColor;
            if (imgParams.dither === 1) {
                let count = mandelbrot(x, y, limit);
                avgColor = colorFromCount(count, limit);
            } else {
                avgColor = [0,0,0];
                for (let ii=0;ii<imgParams.dither;ii++) {
                    for (let jj=0;jj<imgParams.dither;jj++) {
                        let count = mandelbrot(x+imgParams.subIncrBase+ii*imgParams.subIncr,
                            y+imgParams.subIncrBase+jj*imgParams.subIncr,limit);
                        let color = colorFromCount(count, limit);
                        // TODO - forEach() or similar method could be used here - TBD
                        for (let kk=0;kk<3;kk++) {
                            avgColor[kk]+=color[kk];
                        }
                    }
                }
                avgColor.forEach((val,idx)=>{avgColor[idx]=Math.round(val*m2)});  // TODO - refine use of forEach() to use 'this'
            }
            imgDataData[pixelOffset] = avgColor[0];
            imgDataData[pixelOffset+1] = avgColor[1];
            imgDataData[pixelOffset+2] = avgColor[2];
            imgDataData[pixelOffset+3] = 255;
        }
    }
    imgData.data = imgDataData;
    const imgParamsClone = Object.assign({},imgParams);  // shallow clone of imgParams
    imgHistory.push(imgParamsClone);
    ctx.putImageData(imgData,0,0);
    renderHistory();
    if (!canvasHasListener) {
        addCanvasListener();
    }
    button.disabled = false;
    button.className = "buttnavail";
}

function getDitherValue() {
    try {
        let ditherElem = document.getElementById("dither");
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
    let i = event.offsetX;
    let j = event.offsetY;
    let newCtrX = imgParams.xMin + imgParams.incrPerPixel*i;
    let newCtrY = imgParams.yMax - imgParams.incrPerPixel*j;
    let newRealWidth = imgParams.realWidth/zoomFactor;
    let newXmin = newCtrX - newRealWidth/2;
    let newYmin = newCtrY - newRealWidth*(imgParams.canvHeight/imgParams.canvWidth)/2;
    let limElem = document.getElementById("lim");
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
    let r2 = x*x+y*y;
    let count = 0;
    while (count < limit && r2 < limR2) {
        let newU = u*u-v*v + x;
        let newV = 2*u*v + y;
        u = newU;
        v = newV;
        r2 = u*u+v*v;
        count++;
    }
    return count;
}

function colorFromCount(count, limit) {
    // Returns an array representing a color.  See setPalette() for
    // a more detailed explanation.
    if (count >= limit) {
        return [0,0,0];  // black - default value for exceeded limit
    } else {
        if (!palette) {
            setPalette();
        }
        return palette[(Math.floor(count)%(palette.length))];
    }
}

function setPalette() {
    // Sets the global 'palette' variable to be an array of 256 (for now) 
    // 'colors'; however, these colors are actually nested arrays each having
    // three integer values.  These values could later be converted to
    // proper #RRGGBB format HTML colors if so desired but, for the purposes
    // of functions using 'palette', this format is more convenient and enables
    // greater flexibility in making use of these colors - particularly with
    // respect to further mathematical manipulation of the primary values
    // when desired.
    palette = [];
    const SZ = 256;
    for (let i=0;i<SZ;i++) {
        let theta = i*2*Math.PI/SZ;
        let c = colorOfAngle(theta);
        if (i%2===0) {
            c = c.map((val)=>Math.round(val*0.93));  // TODO
        }
        palette.push(c);
    }
    function colorOfAngle(th) {
        // Returns an array of three primary color values, each of
        // which is an integer from 0 to 255.  These returned
        // arrays can be used to determine a corresponding
        // HTML color value (e.g. "#RRGGBB").
        let colr = [];
        for (let i=2;i>=0;i--) {
            colr.push(hexCol(th+i));
        }
        return colr;
        function hexCol(th) {
            // Returns a primary color value (an integer in the range
            // from 0 to 255) based on the ("theta") an angle somewhat
            // akin to a hue value
            let val = (Math.cos(th)+1)/2;
            val = Math.floor(val*256);
            val = Math.max(0,Math.min(255,val));
            return val;
        }
    }
}

function handlePixWidChange(event) {
    const saveWidth = imgParams.canvWidth;
    let newWidStr = pixWidthInput.value.trim();
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
    let tHeadElem = document.createElement("thead");
    let trElem = document.createElement("tr");
    const hdrs = ("Lower-left corner;Width;Limit;Pixel Dimensions;Quality").split(";");
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
    } else if (option === "last") {
        firstIdx = lastIdx;
    } else if (option === "ten") {
        firstIdx = Math.max(0,lastIdx-9);
    } else {
        // unanticipated path, but treat like "last"
        firstIdx = lastIdx;  // TODO - if we move "last" test to end, we can just combine
    }
    let tBodyElem = document.createElement("tbody");
    for (let row=firstIdx;row<=lastIdx;row++) {
        let histRow = imgHistory[row];
        let rowElem = document.createElement("tr");
        const yIsNegative = (histRow.yMin < 0);
        pushCell(rowElem,histRow.xMin + (yIsNegative?" - ":" + ") + Math.abs(histRow.yMin) + "i","center");
        pushCell(rowElem,histRow.realWidth);
        pushCell(rowElem,histRow.limit,"center");
        pushCell(rowElem,histRow.canvWidth + " x " + histRow.canvHeight,"center");
        pushCell(rowElem,histRow.dither,"center");
        tBodyElem.appendChild(rowElem);
    }
    histTable.appendChild(tBodyElem);
    histViewElem.appendChild(histTable);
    //
    function pushCell(tr,cellContent,alignment) {
        let td = document.createElement("td");
        td.textContent = cellContent;
        if (alignment) {
            td.setAttribute("align",alignment);
        }
        tr.appendChild(td);
    }
}

function getHistoryOption() {
    const histSelElem = document.getElementById("histopt");
    if (!histSelElem) {
        console.error("no histopt id found on page");
        return "last";
    }
    const val = histSelElem.value;
    if (!val) {
        console.error("no value for histopt select found");
        return "last;"
    }
    if (["none","last","ten","all"].includes(val)) {  // Restrict to anticipated values
        console.log('using valid path');
        return val
    } else {
        console.log('using default last path');
        return "last";  // otherwise, default to last
    }
}