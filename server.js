var express = require("express");
var bodyParser = require("body-parser");

var PORT = process.env.PORT || 4000;

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
} else {
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

// A GET request to scrape the Smithsonian magazine website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("https://ecadforum.com/", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    // Now, we grab every h3 within an article tag, and do the following:
    $("h2.post-box-title").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).children("a").text();
      result.link ="https://ecadforum.com" + $(this).children("a").attr("href");
      console.log(result);
      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          //console.log(err);
        }
        // Or log the doc
        else {
          //console.log(doc);
        }
      });

    });
  });
  // Tell the browser that we finished scraping the text
  res.redirect("/");
});

app.get("/", function(req, res) {
  Article.find({}, function(err, doc) {
    if (err) {
      res.send(err);
    } else {
      res.render("index", { article: doc });
     // res.send(doc);
    }
  });
});

app.put("/saved/:id", function(req, res) {
  Article.update({ _id: req.params.id }, { $set: { saved: true } }, function(
    err,
    doc
  ) {
    if (err) {
      res.send(err);
    } else {
      res.redirect("/");
    }
  });
});

app.get("/saved", function(req, res) {
  Article.find({ saved: true })
    .populate("notes", "body")
    .exec(function(err, doc) {
      if (err) {
        res.send(err);
      } else {
        res.render("saved", { saved: doc });
      }
    });
});

app.post("/saved/notes/:id", function(req, res) {
  var newNote = new Note(req.body);
  console.log("new note" + newNote);
  newNote.save(function(error, doc) {
    if (error) {
      res.send(error);
    } else {
      Article.findOneAndUpdate(
        { _id: req.params.id },
        { $push: { notes: doc._id } },
        { new: true }
      ).exec(function(err, newdoc) {
        if (err) {
          res.send(err);
        } else {
          res.redirect("/saved");
        }
      });
    }
  });
});

app.put("/delete/:id", function(req, res) {
  Article.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { saved: false } },
    function(err, doc) {
      if (err) {
        res.send(err);
      } else {
        res.redirect("/saved");
      }
    }
  );
});

app.delete("/saved/delete/:id", function(req, res) {
  Note.remove({ _id: req.params.id }, function(err, doc) {
    if (err) {
      res.send(err);
    } else {
      res.redirect("/saved");
    }
  });
});

app.listen(PORT, function() {
  console.log("App running on port " + PORT);
});
