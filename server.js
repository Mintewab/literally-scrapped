var express = require("express");
var bodyParser = require("body-parser");

var PORT = process.env.PORT || 3000;

var logger = require("morgan");
var mongoose = require("mongoose");
var methodOverride = require("method-override");

var Note = require("./models/note.js");
var Article = require("./models/article.js");

var request = require("request");
var cheerio = require("cheerio");
mongoose.Promise = Promise;
var app = express();
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use(express.static("public"));
var databaseURL = "mongodb://localhost/newsScraper";

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI);
}
else {
  mongoose.connect(databaseURL);
}
var db = mongoose.connection;

db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});

db.once("open", function() {
  console.log("Mongoose connection successful.");
});

app.use(methodOverride("_method"));
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

app.get("/scrape", function(req, res) {
  
  request("https://www.bbc.com", function(error, response, html) {
    
    var $ = cheerio.load(html);
        $("h3.headline").each(function(i, element) {

      var result = {};
      result.title = $(this).children("a").text();
      result.link ="https://www.bbc.com" + $(this).children("a").attr("href");
      var entry = new Article(result);
      entry.save(function(err, doc) {
   
        if (err) {
          console.log(err);
        }
      
        else {
          console.log(doc);
        }
      });

    });
  });

  res.redirect("/");
});



app.get("/", function (req, res) {
	Article.find({}, function(err, doc) {
		if (err) {
			res.send(err);
		}

		else{
			res.render("index", {article: doc} );
		}
	});
});


app.put("/saved/:id", function(req, res) {
  Article.update({_id: req.params.id}, {$set: {saved: true}}, function(err, doc) {
    if (err) {
      res.send(err);
    }
    else {
      res.redirect("/");
    }
  });
});

app.get("/saved", function(req, res) {
  Article.find({saved: true}).populate("notes", 'body').exec(function(err, doc) {
    if (err) {
      res.send(err);
    }
    else {
      res.render("saved", {saved: doc});
    }
  });
});

app.post("/saved/notes/:id", function(req, res) {
  var newNote = new Note(req.body);
  console.log("new note" + newNote);
  newNote.save(function(error, doc) {
    if (error) {
      res.send(error);
    }
    else {
      Article.findOneAndUpdate({_id: req.params.id}, { $push: { "notes": doc._id } }, { new: true }).exec(function(err, newdoc) {
        if (err) {
          res.send(err);
        }
        else {
          res.redirect("/saved");
        }
      });
    }
  });
});


app.put("/delete/:id", function(req, res) {
  Article.findOneAndUpdate({_id: req.params.id}, {$set: {saved: false}}, function(err, doc) {
    if (err) {
      res.send(err);
    }
    else {
      res.redirect("/saved");
    }
  });
});

app.delete("/saved/delete/:id", function(req, res) {
  Note.remove({_id: req.params.id}, function(err, doc){
    if (err) {
      res.send(err);
    }
    else {
      res.redirect("/saved");
    }
  });
});

app.listen(PORT, function() {
  console.log("App running on port " + PORT);
});