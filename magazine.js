/**********************************************************************
**********************************************************************/

var DEBUG = true

/* this is needed only for live resize... */
var PAGES_VISIBLE = 1
var PAGES_IN_RIBBON = 6
/*********************************************************************/
// XXX move to generic lib...

// this will create a function that will add/remove a css_class to elem 
// calling the optional callbacks before and/or after.
//
// elem is a jquery compatible object; default use-case: a css selector.
//
// the resulting function understands the folowing arguments:
// 	- 'on'			: switch mode on
// 	- 'off'			: switch mode off
// 	- '?'			: return current state ('on'|'off')
// 	- no arguments	: toggle the state
//
// NOTE: of only one callback is given then it will be called after the 
// 		 class change...
// 		 a way around this is to pass an empty function as callback_b
//
function createCSSClassToggler(elem, css_class, callback_a, callback_b){
	// prepare the pre/post callbacks...
	if(callback_b == null){
		var callback_pre = null
		var callback_post = callback_a
	} else {
		var callback_pre = callback_a
		var callback_post = callback_b
	}
	// build the acual toggler function...
	var func = function(action){
		if(action == null || action == '?'){
			var getter = action == '?' ? true : false
			action = 'on'
			// get current state...
			if( $(elem).hasClass(css_class) ){
				action = 'off'
			}
			if(getter){
				// as the above actions indicate intent and not state, 
				// we'll need to swap the values...
				return action == 'on' ? 'off' : 'on'
			}
		}
		if(callback_pre != null){
			callback_pre(action)
		}
		// play with the class...
		if(action == 'on'){
			$(elem).addClass(css_class)
		} else {
			$(elem).removeClass(css_class)
		}
		if(callback_post != null){
			callback_post(action)
		}
	}
	func.doc = 'With no arguments this will toggle between "on" and '+
		'"off".\n'+
		'If either "on" or "off" are given then this will switch '+
		'to that mode.\n'+
		'If "?" is given, this will return either "on" or "off" '+
		'depending on the current state.'
	return func
}


// show a jQuary opject in viewer overlay...
// XXX need to set .scrollTop(0) when showing different UI... 
// 		...and not set it when the UI is the same
// XXX this must create it's own overlay...
function showInOverlay(obj){
	obj.click(function(){ return false })
	// XXX 
	$('.viewer').addClass('overlay-mode')
	// clean things up...
	$('.overlay .content').children().remove()
	// put it in the overlay...
	$('.overlay .content').append(obj)
	// prepare the overlay...
	$('.overlay')
		.one('click', function(){
			$('.overlay')
				.fadeOut(function(){
					$('.overlay .content')
						.children()
							.remove()
					$('.overlay-mode').removeClass('overlay-mode')
				})
		})
		.fadeIn()
	return obj
}



function overlayMessage(text){
	return showInOverlay($('<div class="overlay-message">' +text+ '</div>'))
}




// XXX might be good to use apply here...
function doWithoutTransitions(obj, func, time){
	if(time == null){
		time = 5
	}	
	obj.addClass('unanimated')
	var res = func()
	setTimeout(function(){obj.removeClass('unanimated')}, time)
	return res
}

function unanimated(obj, func, time){
	return function(){
		if(time == null){
			time = 5
		}	
		obj.addClass('unanimated')
		var res = func.apply(func, arguments)
		setTimeout(function(){obj.removeClass('unanimated')}, time)
		return res
	}
}

// Return a scale value for the given element(s).
// NOTE: this will only return a single scale value...
function getElementScale(elem){
	//var transform = elem.css('transform')
	var vendors = ['o', 'moz', 'ms', 'webkit']
	var transform = elem.css('transform')
	var res

	// go through vendor prefixes... (hate this!)
	if(!transform || transform == 'none'){
		for(var i in vendors){
			transform = elem.css('-' + vendors[i] + '-transform')
			if(transform && transform != 'none'){
				break
			}
		}
	}
	// no transform is set...
	if(!transform || transform == 'none'){
		return 1
	}
	// get the scale value -- first argument of scale/matrix...
	return parseFloat((/(scale|matrix)\(([^,]*),.*\)/).exec(transform)[2])
}

function setElementScale(elem, scale){
	return elem.css({
		'transform': 'scale('+scale+')',
		'-moz-transform': 'scale('+scale+')',
		'-o-transform': 'scale('+scale+')',
		'-ms-transform': 'scale('+scale+')',
		'-webkit-transform': 'scale('+scale+')',
	})
}




/*********************************************************************/

togglePageDragging = createCSSClassToggler(
	'.viewer',
	'dragging')


var FIT_PAGE_TO_VIEW = true

togglePageView = createCSSClassToggler(
	'.viewer', 
	'page-view-mode',
	null,
	// post-change callback...
	function(){
		if(togglePageView('?') == 'on'){
			PAGES_VISIBLE = 1
			if(FIT_PAGE_TO_VIEW){
				fitPagesToViewer(PAGES_VISIBLE)
			} else {
				fitNPages(PAGES_VISIBLE)
				// to prevent drag while zooming to affect
				// the resulting position set it to current 
				// page...
				// XXX now this is done by fitNPages
				setCurrentPage()
			}
		} else {
			PAGES_VISIBLE = PAGES_IN_RIBBON
			if(FIT_PAGE_TO_VIEW){
				// XXX this needs to be done before transitions...
				fitPagesToContent(PAGES_VISIBLE)
			} else {
				fitNPages(PAGES_VISIBLE)
			}
		}
	})

function getPageScale(){
	return getElementScale($('.scaler'))
}

function fitNPages(n){
	if(n==null){
		n = 1
	}
	var pages = $('.page')
	var view = $('.viewer')
	var W = view.width()
	var H = view.height()
	var w = pages.width()
	var h = pages.height()

	var scale = W/(w*n)

	// fit vertically if needed...
	if(h*scale > H){
		scale = H/h
	}

	setElementScale($('.scaler'), scale)

	/* XXX
	fitPagesTo(null, n)
	*/
}

// NOTE: this is a single big function because we need to thread data 
//		through to avoid sampling while animating...
// XXX try and do the fitting with pure CSS...
// XXX BUG: changing width when content is constrained only horizontally
//		breaks this...
function fitPagesTo(elem, n){
	if(n==null){
		n = 1
	}
	var pages = $('.page')
	var view = $('.viewer')
	var content = $('.content')
	if(elem == null){
		elem = view
	} else {
		elem = $(elem)
	}

	// sample data...
	var vW = view.width()
	var vH = view.height()
	var cW = content.width()
	var cH = content.height()
	var W = elem.width()
	var H = elem.height()
	var w = pages.width()
	var h = pages.height()
	var rW = w
	var rH = h

	// NOTE: there must be no data sampling after this point...
	//		this is due to the fact that we will start changing stuff next
	//		and if CSS transitions are at play new samples will be off...


	// XXX fitting works ONLY in one direction, if both sides need 
	//		to be adjusted the this breaks everything...

	// do the fitting...
	if(W-cW/H-cH > 1){
		rW = W * (cH/H) 
		pages.width(rW)
		pages.height(cH)
		$('.magazine').css({
			'margin-left': -rW/2
		})
	} 
	if(W-cW/H-cH < 1){
		rH = H * (cW/W)
		pages.height(rH)
		pages.width(cW)
		$('.page').css({
			'margin-top': -rH/2
		})
	}

	// scale horizontally...
	// NOTE: this is done so as to keep the scale within the content constant...
	var scale = vW/(rW*n)
	// or scale vertically if needed...
	// XXX broken
	//if(rH*scale > vH){
	//	scale = vH/rH
	//}

	setElementScale($('.scaler'), scale)
	// update position using the new width...
	setCurrentPage(null, rW)
}


function fitPagesToViewer(n){
	fitPagesTo('.viewer', n)
}
function fitPagesToContent(n){
	fitPagesTo('.page .content', n)
}


function swipeUpdate(evt, phase, direction, distance, duration, fingers){
	var pages = $('.page')
	var cur = $('.current.page')
	var n = pages.index(cur)
	var scale = getPageScale()
	var mag = $('.magazine')

	if( phase=='move' && (direction=='left' || direction=='right') ){
		mag.addClass('unanimated')
		if (direction == 'left'){
			$('.magazine').css({left: -n*cur.width()-distance/scale})
		} else if (direction == 'right') {
			$('.magazine').css({left: -n*cur.width()+distance/scale})
		}
		setTimeout(function(){mag.removeClass('unanimated')}, 5)

	} else if ( phase == 'start') {
		togglePageDragging('on')

	} else if ( phase == 'cancel') {
		togglePageDragging('off')
		setCurrentPage()

	} else if ( phase =='end' ) {
		togglePageDragging('off')
		// see which page is closer to the middle of the screen and set it...
		// do this based on how much we dragged...
		var p = Math.ceil((distance/scale)/cur.width())

		// prev page...
		if(direction == 'right') {
			// two+ fingers moves to closest article...
			if(fingers >= 2){
				prevArticle()
			} else {
				setCurrentPage(Math.max(n-p, 0))
			}
		// next page...
		} else if (direction == 'left'){
			// two+ fingers moves to closest article...
			if(fingers >= 2){
				nextArticle()
			} else {
				setCurrentPage(Math.min(n+p, pages.length-1))
			}
		}
	}
}


function setCurrentPage(n, W){
	if(n == null){
		var cur = $('.current.page')
		n = $('.page').index(cur) 
	} else if(typeof(n) == typeof(1)) {
		var cur = $($('.page')[n])
	} else {
		var cur = $(n)
		n = $('.page').index(cur) 
	}

	$('.current.page').removeClass('current')
	cur.addClass('current')

	var mag = $('.magazine')
	var W = W == null ? cur.width() : W
	mag.css({left: -n*W})

	// XXX should this be here???
	saveState()

	return cur
}

function getPageNumber(page){
	if(page == null){
		page = $('.current.page')
	}
	return $('.page').index(page) 
}



function nextPage(){
	var pages = $('.page')
	var cur = $('.current.page')
	return setCurrentPage(Math.min(pages.index(cur)+1, pages.length-1))
}
function prevPage(){
	var pages = $('.page')
	var cur = $('.current.page')
	return setCurrentPage(Math.max(pages.index(cur)-1, 0))
}



function goToMagazineCover(){
	setCurrentPage(0)
}
function goToArticleCover(){
	setCurrentPage($('.current.page').parents('.article').children('.page').first())
}



function nextArticle(){
	var cur = $('.current.page').parents('.article')
	// we are at the magazine cover cover...
	if(cur.length == 0){
		return setCurrentPage(
			$('.article .page:first-child').first())
	}
	// just find the next one...
	var articles = $('.article')
	return setCurrentPage(
		$(articles[Math.min(articles.index(cur)+1, articles.length-1)])
			.children('.page')
			.first())

}
// XXX this is almost exactly the same as nextArticle...
function prevArticle(){
	var cur = $('.current.page').parents('.article')
	// we are at the magazine cover cover...
	if(cur.length == 0){
		return $('.current.page')
	}
	// just find the prev one...
	var articles = $('.article')
	return setCurrentPage(
		$(articles[Math.max(articles.index(cur)-1, 0)])
			.children('.page')
			.first())
}



/*********************************************************************/
// XXX make these magazine-specific...
// XXX BUG: if the hash url part coresponds to a real anchor the browser 
// 		shifts the page, need to disable this...
// URL state managers...
function loadURLState(){
	if(window.location.hash == ''){
		return null
	}
	var anchor = window.location.hash.split('#')[1]
	var n = parseInt(anchor)
	if(typeof(n) == typeof(1) && n >= 0){
		return n

	// XXX add real external aliases...
	} else if(anchor == 'thumbnails') {
		togglePageView('off')
		return getPageNumber()

	} else if(anchor == 'home') {
		return 0

	} else if(anchor == 'end') {
		return $('.page').length-1

	// relative URLs...
	} else if(anchor == 'next') {
		nextPage()
		return getPageNumber()

	} else if(anchor == 'prev') {
		prevPage()
		return getPageNumber()

	} else if(anchor == 'nextArticle') {
		nextArticle()
		return getPageNumber()

	} else if(anchor == 'prevArticle') {
		prevArticle()
		return getPageNumber()

	// hide all visible layers on current page...
	} else if(anchor == 'hideLayers') {
		$('.current.page .shown')
			.addClass('hidden')
			.removeClass('shown')
		return getPageNumber()

	} else {
		var elem = $('[name='+anchor+']')
		n = getPageNumber(elem.parents('.page'))
		// toggle hidden/shown elements...
		if(elem.hasClass('hidden')){
			elem
				.addClass('shown')
				.removeClass('hidden')
		} else if(elem.hasClass('shown')){
			elem
				.addClass('hidden')
				.removeClass('shown')
		}
		return n
	}
}
function saveURLState(){
	var anchor = window.location.hash.split('#')[1]
	var elem = $('[name='+anchor+']')
	var page = elem
	if(!page.hasClass('page')){
		page = page.parents('.page')
	}
	var n = getPageNumber()

	// decide which #URLs stay in the URL and which get replaces with a
	// page number...
	if(!elem.hasClass('shown') && !elem.hasClass('hidden')){
		// XXX use real aliases...
		// do not replace these urls with page numbers...
		if( n == getPageNumber(page)
				|| (anchor == 'home' && n == 0)
				|| (anchor == 'end' && n == $('.page').length-1)){
			return anchor
		}
	}
	window.location.hash = n
	return n
}

// local storage state managers...
function loadStorageState(){
	return parseInt($.jStorage.get('current_page', 0))
}
function saveStorageState(){
	$.jStorage.set('current_page', getPageNumber())
}

// generic state managers...
function loadState(){
	var n = loadURLState()
	if(n != null){
		setCurrentPage(n)
	} else {
		setCurrentPage(loadStorageState())
	}
}
function saveState(){
	saveURLState()
	saveStorageState()
}


/*********************************************************************/

// XXX create magazine...
function createMagazine(){
}

// XXX create article (magazine, title, position)...
function createArticle(magazine, title){
}

// XXX create page (article, template, position)...
function createPage(article, template){
}


/*********************************************************************/
// vim:set ts=4 sw=4 :