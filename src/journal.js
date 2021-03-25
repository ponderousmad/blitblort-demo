var JOURNAL = (function (SCRUB) {
    "use strict";

    function Editor() {
        this.editArea = document.getElementById("entry");
        this.logView = document.getElementById("log");
        this.content = new SCRUB.Sequence();
        var self = this;

        var addButton = document.getElementById("buttonAdd");
        if (addButton) {
            addButton.addEventListener("click", function(e) {
                self.add(self.editArea.value);
                self.editArea.value = "";
            });
        }
        var fileUpload = document.getElementById("fileUpload");
        var loadButton = document.getElementById("buttonLoad");
        if (fileUpload && loadButton) {
            loadButton.addEventListener("click", function(e) {
                fileUpload.click();
            });
            fileUpload.addEventListener("change", function(e) {
                const reader = new FileReader();
                reader.onload = function(loadEvent) {
                    self.load(loadEvent.target.result);
                };
                reader.readAsText(e.target.files[0]);
            });
        }
        var saveButton = document.getElementById("buttonSave");
        if (saveButton) {
            saveButton.addEventListener("click", function(e) {
                self.save();
            });
        }

        this.load(window.localStorage.getItem("journal"));
    }

    Editor.prototype.load = function (json) {
        this.content.clear();
        if (json) {
            var data = JSON.parse(json);
            this.content.append(data);
        }
        this.syncLog();
    };

    Editor.prototype.save = function () {
        var blob = new Blob([JSON.stringify(this.content)], { type: 'application/json' });
        var a = document.createElement('a');
        a.download = 'journal.json';
        a.href = window.URL.createObjectURL(blob);
        a.click();
        window.URL.revokeObjectURL(blob);
    };

    Editor.prototype.checkpoint = function () {
        window.localStorage.setItem("journal", JSON.stringify(this.content));
    };

    Editor.prototype.add = function (note) {
        this.content.snapshot(note);
        this.syncLog();
    };

    Editor.prototype.syncLog = function () {
        this.logView.innerHTML = "";

        for(var i = 0; i < this.content.entries.length; ++i) {
            var div = document.createElement("div");
            div.appendChild(document.createTextNode(this.content.entries[i].value));
            this.logView.appendChild(div);
        }
        this.checkpoint();
    };

    return {
        Editor  : Editor
    };
})(SCRUB);