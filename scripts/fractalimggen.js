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
        console.log('canvas dims = ', canvas.width, ' x ', canvas.height);
        const pixWidElem = document.getElementById("pixwid");
        if (pixWidElem) {
            pixWidElem.value = canvas.width;
            console.log('pix wid set to ', pixWidElem.value);
        }
    }
    // If wid and hgt parameters are not provided then default to pre-existing
    // canvas dimensions, presumably as specified in the HTML
    ctx.fillRect(0,0,(wid?wid:canvas.width),(hgt?hgt:canvas.height));
}

function fractalGenPageInit() {
    initCanvasOnly();
    let drawButton = document.getElementById("redrawbutton");
    if (drawButton) {
        drawButton.addEventListener("click",()=>{
            let lim = parseInt((document.getElementById("lim")).value);
            drawMandelbrot(imgParams.xMin,imgParams.yMin,imgParams.realWidth,lim);
        });
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
    let button = document.getElementById("redrawbutton");
    button.disabled = true;
    button.className = "buttnnotavail";
    for (let j=0;j<imgParams.canvHeight;j++) {
        let y = imgParams.yMax-imgParams.incrPerPixel*j;  // Note subtraction, this 
            // introduces the standard Cartesian coordinate
            // orientation despite the opposing HTML convention.
        let rowOffset = j*imgParams.canvWidth*4;
        let pixelOffset = rowOffset-4;  // Note the -4 is deliberate
        for (let i=0;i<imgParams.canvWidth;i++) {
            let x = imgParams.xMin+imgParams.incrPerPixel*i;
            pixelOffset+=4;
            // TODO - *temporarily* ignore pixelOffset and just draw a rectangle (rectFill())
            let count = mandelbrot(x, y, limit);
            let color = colorFromCount(count, limit);
            ctx.fillStyle = color;
            ctx.fillRect(i,j,1,1);
        }
    }
    if (!canvasHasListener) {
        addCanvasListener();
    }
    button.disabled = false;
    button.className = "buttnavail";
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
    if (count >= limit) {
        return '#000000';
    } else {
        if (!palette) {
            setPalette();
        }
        return palette[(Math.floor(count)%256)];
    }
}

function setPalette() {
    palette = [];
    for (let i=0;i<256;i++) {
        let theta = i*2*Math.PI/256;
        palette.push(colorOfAngle(theta));
    }
}

function colorOfAngle(th) {
    let colr = '#';
    colr += hexCol(th+2);
    colr += hexCol(th+1);
    colr += hexCol(th);
    return colr;
}

function hexCol(th) {
    let val = (Math.cos(th)+1)/2;
    val = Math.round(val*255);
    let hx = val.toString(16);
    hx = hx.padStart(2,'0');
    return hx;
}

function handlePixWidChange(event) {
    const saveWidth = imgParams.canvWidth;
    let newWidStr = pixWidthInput.value.trim();
    try {
        console.log('newWidStr = "', newWidStr, '"');
        const newWid = parseInt(newWidStr);
        console.log('newWid = ', newWid);
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