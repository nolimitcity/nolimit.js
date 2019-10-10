function preventResize(e){
    if(e.scale !== 1) {
        e.preventDefault();
        e.stopPropagation();
    }
}

var iosFullscreen = {
    init: function() {
        var ua = navigator.userAgent.toLowerCase();
        var isSafari = ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1;
        var iFramed = window.top !== window;

        if(!isSafari || iFramed) {
            return;
        }

        var swiper = document.createElement('div');
        swiper.id = 'nolimit-swiper';
        // TODO CSS this

        // swiper.addEventListener()
        document.body.appendChild(swiper);

    },

    start: function() {

    }


};

module.exports = iosFullscreen;
