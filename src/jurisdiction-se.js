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
    return spelpausUrl && spelgranserUrl && sjalvtestUrl;
}

function isEvents() {
    return events === true;
}

var jurisdictionSE = {
    init: function(options, document, nolimitApi) {
        if (options.jurisdiction && options.jurisdiction.name === 'SE' && (isLinks() || isEvents())) {
            var style = document.createElement('style');
            document.head.appendChild(style);
            style.appendChild(document.createTextNode(require('./jurisdiction-se.css')));
            var linkHolder = document.createElement('div');
            linkHolder.classList.add('jurisdiction-se-links');
            
            var spelpausImg = document.createElement('img');
            spelpausImg.src = SPELPAUS;
            linkHolder.appendChild(spelpausImg);
            spelpausImg.addEventListener('click', function() {
                if (isLinks()) {
                    window.open(spelpausUrl, target);
                }
                if (isEvents()) {
                    nolimitApi.trigger('spelpaus');
                }
            });

            var spelgranserImg = document.createElement('img');
            spelgranserImg.src = SPELGRANSER;
            linkHolder.appendChild(spelgranserImg);
            spelgranserImg.addEventListener('click', function() {
                if (isLinks()) {
                    window.open(spelgranserUrl, target);
                }
                if (isEvents()) {
                    nolimitApi.trigger('spelgranser');
                }
            });

            var sjalvtestImg = document.createElement('img');
            sjalvtestImg.src = SJALVTEST;
            linkHolder.appendChild(sjalvtestImg);
            sjalvtestImg.addEventListener('click', function() {
                if (isLinks()) {
                    window.open(sjalvtestUrl, target);
                }
                if (isEvents()) {
                    nolimitApi.trigger('sjalvtest');
                }
            });

            document.appendChild(linkHolder);
        }
    },
    takeLinks: function(options) {
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
}

module.exports = jurisdictionSE;