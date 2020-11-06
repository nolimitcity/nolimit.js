var BASE_URL = 'https://nolimitjs.nolimitcdn.com/img';
var SPELPAUS = BASE_URL + '/spelpaus.svg';
var SPELGRANSER = BASE_URL + '/spelgranser.svg';
var SJALVTEST = BASE_URL + '/sjalvtest.svg';

var spelpausUrl;
var spelgranserUrl;
var sjalvtestUrl;
var target;
var events;

function isLinks() {
    return !!(spelpausUrl && spelgranserUrl && sjalvtestUrl);
}

function isEvents() {
    return events === true;
}

function createListener(element, url, target, event, nolimitApi) {
    var links = isLinks();
    var events = isEvents();
    var urlCopy = '' + url;
    var targetCopy = '' + target;
    element.addEventListener('click', function() {
        if (links) {
            window.open(urlCopy, targetCopy);
        }
        if (events) {
            nolimitApi.trigger(event);
        }
    });
}

var jurisdictionSE = {
    init: function(options, document, nolimitApi) {
        console.log('sweden links', options.jurisdiction, isLinks(), isEvents());
        if (options.jurisdiction && options.jurisdiction.name === 'SE' && (isLinks() || isEvents())) {
            var style = document.createElement('style');
            document.head.appendChild(style);
            style.appendChild(document.createTextNode(require('./jurisdiction-se.css')));
            var linkHolder = document.createElement('div');
            linkHolder.classList.add('jurisdiction-se-links');

            var spelpausImg = document.createElement('img');
            spelpausImg.src = SPELPAUS;
            linkHolder.appendChild(spelpausImg);
            createListener(spelpausImg, spelpausUrl, target, 'spelpaus', nolimitApi);

            var spelgranserImg = document.createElement('img');
            spelgranserImg.src = SPELGRANSER;
            linkHolder.appendChild(spelgranserImg);
            createListener(spelgranserImg, spelgranserUrl, target, 'spelgranser', nolimitApi);

            var sjalvtestImg = document.createElement('img');
            sjalvtestImg.src = SJALVTEST;
            linkHolder.appendChild(sjalvtestImg);
            createListener(sjalvtestImg, sjalvtestUrl, target, 'sjalvtest', nolimitApi);

            var plus18 = document.createElement('span');
            plus18.innerHTML = '+18';
            plus18.style.fontSize = '12px';
            linkHolder.appendChild(plus18);

            document.body.appendChild(linkHolder);

            //var container = document.body.querySelector('.nolimit.container');
            //if (container) {
            //    container.style.top = '24px';
            //}
        }
    },
    takeOptions: function(options) {
        if (options.jurisdiction && options.jurisdiction.name === 'SE') {
            spelpausUrl = options.jurisdiction.spelpaus;
            delete options.jurisdiction.spelpaus;
            spelgranserUrl = options.jurisdiction.spelgranser;
            delete options.jurisdiction.spelgranser;
            sjalvtestUrl = options.jurisdiction.sjalvtest;
            delete options.jurisdiction.sjalvtest;
            target = options.jurisdiction.target || '_top';
            delete options.jurisdiction.target;
            events = options.jurisdiction.events === true;
            delete options.jurisdiction.events;
        }
    }
};

module.exports = jurisdictionSE;
