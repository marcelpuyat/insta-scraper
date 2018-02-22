var phantom = require('phantom');
var cheerio = require('cheerio');
var fs = require('fs');
var async = require('async');
var tagQueue = async.queue(function(task, printTagDone) {
	crawlHashtag(task.tag, printTagDone);
}, 3);

var getHashtagsQueue = async.queue(function(task, printPostDone) {
	getHashtagsInPost(task.postLink, task.tag, printPostDone);
}, 3);


const hashtag = process.argv[2];
const hashtagLoadFile = process.argv[3];
const associationsLoadFile = process.argv[4];

var associations = {};
var posts = {};

if (hashtagLoadFile) {
	posts = JSON.parse(fs.readFileSync(hashtagLoadFile));
	console.dir(posts)
}

if (associationsLoadFile) {
	associations = JSON.parse(fs.readFileSync(associationsLoadFile));
	console.dir(associations)
}

var numHashTagsWritten = 0;
var fileVersion = 1;

tagQueue.push({"tag": hashtag});

function printTagDone(tag) {
	console.log("Done with tag: " + tag);
}
function printPostDone(post) {
	console.log("Done with post: " + post);
}

function getHashtagsInPost(postLink, tag, printDone) {
	phantom.create().then(function(ph2) {
		ph2.createPage().then(function(page2) {
			page2.open(postLink).then(function(status) {
        		console.log("Finding hashtags in link: " + postLink);
        		if (status == 'success') {
        			page2.property('content').then(function(content2) {
        				if (content2) {
        					var $ = cheerio.load(content2);
        					ph2.exit();
        					if ($) {
        						var aTags = $("a");
        						if (aTags) {
        							aTags.each(function(i, elem) {
				        				var href = $(elem).attr('href');
				        				if (href && href.includes("/explore/tags")) {
				        					var newTag = href.split('/')[3];
				        					if (newTag == tag || !newTag.match(/^[0-9a-z]+$/)) {
				        						// Skip because this is the tag we are crawling.
				        						return;
				        					}
				        					if (!associations["#" + tag + " : #" + newTag]) {
				        						associations["#" + tag + " : #" + newTag] = 0;
				        					}
				        					associations["#" + tag + " : #" + newTag] += 1;
				        					console.log("association between " + tag + " and " + newTag + ": " + associations["#" + tag + " : #" + newTag]);
		        							tagQueue.push({"tag": newTag});
		        						}
		        					});
		        					printDone(postLink);
        						}
        					}
        				}
    				}).catch(printDone);
        		} else {
        			console.log("failed to load post for link " + postLink);
        			printDone(postLink);
        		}
        	}).catch(printDone);;
		}).catch(printDone);
	}).catch(printDone);
}

function crawlHashtag(tag, printDone) {
	if (!tag.match(/^[0-9a-z]+$/)) {
		console.log("Skipping tag: " + tag);
		printDone(tag);
		return;
	}
	console.log("Crawling hashtag: #" + tag + "...")
	phantom.create().then(function(ph) {
  		ph.createPage().then(function(page) {
    		page.open('http://instagram.com/explore/tags/' + tag).then(function(status) {
    			console.log(status);
      			if (status == "success") {
      				page.property('content').then(function(content) {
      					ph.exit();
      					console.log("Process for tag: "+tag+ " exiting");
	        			var $ = cheerio.load(content);
	        			console.log($("header span span").text() + " posts for tag: " + tag);
	        			numHashTagsWritten++;
        				if (numHashTagsWritten % 20 == 0) {
        					console.log("Writing version " + fileVersion);
				        	fs.writeFileSync("new_data/hashtags"+fileVersion+".json", JSON.stringify(posts))
				        	fs.writeFileSync("new_data/associations"+fileVersion+".json", JSON.stringify(associations));
        					fileVersion++;
       					}
				        posts[tag] = Number($("header span span").text().replace(/,/g,""));
				        var images = $("article div div div div");
				        images.children().each(function(i, elem) {
				        	var href = $(elem).find('div a').attr('href');
				        	var link = "http://instagram.com" + href;
				        	if (href) {
				        		console.log("Found top image link: " + "http://instagram.com" + href);
				        		getHashtagsQueue.push({"postLink": link, "tag": tag});
				        	}
				        })
				        printDone(tag);
					}).catch(printDone);
				} else {
					console.log("Failed to load first page");
					printDone(tag);
				}
			}).catch(printDone)
		}).catch(printDone)
	}).catch(printDone)
}

function logErr(err) {
	console.log(err);
}