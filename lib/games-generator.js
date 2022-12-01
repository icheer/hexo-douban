'use strict';

var request = require('request-promise');
var ejs = require('ejs');
var cheerio = require('cheerio');
var path = require('path');
var renderStar = require('./util').renderStar;
var i18n = require('./util').i18n;
var offline = false;

var log = require('hexo-log')({
    debug: false,
    silent: false
});

async function resolv(url, timeout) {
    var response = '';
    try {
        response = await request(url, {
            timeout: timeout,
            dataType: 'xml'
        });
    } catch (err) {
        offline = true;
    }

    if (offline) {
        return {
            list: [],
            next: ""
        };
    }

    var $ = cheerio.load(response.data);

    var items = $('game-list .common-item');
    var list = [];
    var next = $('span.next a').attr('href');
    if (next.startsWith("?")) {
        next = url.substring(0, url.lastIndexOf('?')) + next;
    }
    items.each(idx, $el) {
        var title = $el.find('div.title a').text();
        var alt = $el.find('div.title a').attr('href');
        var image = $el.find('div.pic a img').attr('src');
        var tags = $el.find('div.rating-info span.tags').text();
        tags = tags ? tags.substr(3) : '';
        var date = $el.find('div.rating-info span.date').text();
        var recommend = $el.find('div.rating-info span[class*=allstar]').attr('class');
        recommend = renderStar(recommend.substr(19, 1));
        var comment = $el.find('div.content div:not(class)').text();
        var info = $el.find('div.desc').text();
        info = info.replace(/(^\s*)|(\s*$)/g, '');

        list.push({
            title: title,
            alt: alt,
            image: image,
            tags: tags,
            date: date,
            recommend: recommend,
            comment: comment,
            info: info
        });
    }

    return {
        'list': list,
        'next': next
    };
}

module.exports = async function (locals) {

    var startTime = new Date().getTime();

    var config = this.config;

    if (!config.douban || !config.douban.game) {//当没有输入game信息时，不进行数据渲染。
        return;
    }

    var root = config.root;
    if (root.endsWith('/')) {
        root = root.slice(0, root.length - 1);
    }

    var timeout = 10000;
    if (config.douban.timeout) {
        timeout = config.douban.timeout;
    }

    var rawUrl = 'https://www.douban.com/people/' + config.douban.user + '/games';
    var playedUrl = rawUrl + '?action=collect';
    var playingUrl = rawUrl + '?action=do';
    var wishUrl = rawUrl + '?action=wish';

    var wish = [];
    var played = [];
    var playing = [];
    for (var nextWish = wishUrl; nextWish;) {
        var resWish = await resolv(nextWish, timeout);
        nextWish = resWish.next;
        wish = wish.concat(resWish.list);
    }
    console.log(`想玩: ${wish.length}`);

    for (var nextPlaying = playingUrl; nextPlaying;) {
        var resPlaying = await resolv(nextPlaying, timeout);
        nextPlaying = resPlaying.next;
        playing = playing.concat(resPlaying.list);
    }
    console.log(`在玩: ${playing.length}`);

    for (var nextPlayed = playedUrl; nextPlayed;) {
        var resPlayed = await resolv(nextPlayed, timeout);
        nextPlayed = resPlayed.next;
        played = played.concat(resPlayed.list);
    }
    console.log(`玩过: ${played.length}`);

    var endTime = new Date().getTime();

    var offlinePrompt = offline ? ", because you are offline or your network is bad" : "";

    var sum = wish.length + playing.length + played.length;
    log.info(`${sum} games have been loaded in ` + (endTime - startTime) + " ms" + offlinePrompt);
    if (!sum) return;

    var __ = i18n.__(config.language);

    var contents = ejs.renderFile(path.join(__dirname, 'templates/game.ejs'), {
        'quote': config.douban.game.quote,
        'wish': wish,
        'played': played,
        'playing': playing,
        '__': __,
        'root': root
    }, function (err, result) {
        if (err) console.log(err);
        return result;
    });

    return {
        path: 'games/index.html',
        data: {
            title: config.douban.game.title,
            content: contents,
            slug: 'games'
        },
        layout: ['page', 'post']
    };
};
