'use strict';

module.exports.renderStar = function (num) {
    switch (num) {
        case '1':
            return '★☆☆☆☆ 很差';
        case '2':
            return '★★☆☆☆ 较差';
        case '3':
            return '★★★☆☆ 还行';
        case '4':
            return '★★★★☆ 推荐';
        case '5':
            return '★★★★★ 力荐';
        default:
            return '';
    }
};

var I18N = require('hexo-i18n');

var i18n = new I18N({
    languages: ['zh-CN', 'en']
});

i18n.set('en', {
    movieWish: 'Wish',
    movieWatching: 'Watching',
    movieWatched: 'Watched',
    albumWish: 'Wish',
    albumListening: 'Listening',
    albumListened: 'Listened',
    bookWish: 'Wish',
    bookReading: 'Reading',
    bookRead: 'Read',
    gameWish: 'Wish',
    gamePlaying: 'Playing',
    gamePlayed: 'Played',
    prev: 'Prev',
    next: 'Next',
    top: 'Top',
    end: 'End'
});

i18n.set('zh-TW', {
    movieWish: '想看',
    movieWatching: '在看',
    movieWatched: '看过',
    albumWish: '想听',
    albumListening: '在听',
    albumListened: '听过',
    bookWish: '想读',
    bookReading: '在读',
    bookRead: '读过',
    gameWish: '想玩',
    gamePlaying: '在玩',
    gamePlayed: '玩过',
    prev: '上一頁',
    next: '下一頁',
    top: '首頁',
    end: '尾頁'
});

i18n.set('zh-Hans', {
    movieWish: '想看',
    movieWatching: '在看',
    movieWatched: '看过',
    albumWish: '想听',
    albumListening: '在听',
    albumListened: '听过',
    bookWish: '想读',
    bookReading: '在读',
    bookRead: '读过',
    gameWish: '想玩',
    gamePlaying: '在玩',
    gamePlayed: '玩过',
    prev: '上一页',
    next: '下一页',
    top: '首页',
    end: '尾页'
});

i18n.set('zh-CN', {
    movieWish: '想看',
    movieWatching: '在看',
    movieWatched: '看过',
    albumWish: '想听',
    albumListening: '在听',
    albumListened: '听过',
    bookWish: '想读',
    bookReading: '在读',
    bookRead: '读过',
    gameWish: '想玩',
    gamePlaying: '在玩',
    gamePlayed: '玩过',
    prev: '上一页',
    next: '下一页',
    top: '首页',
    end: '尾页'
});

module.exports.i18n = i18n;
