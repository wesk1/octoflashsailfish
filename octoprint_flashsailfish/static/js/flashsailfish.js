/*
 * View model for OctoPrint-FlashSailfish
 *
 * Author: Mark Walker
 * License: GPLv3
 */
$(function() {
    function FlashsailfishViewModel(parameters) {
        const self = this;

        self.settings = parameters[0];

        self.boards = ko.observableArray([]);
        self.board = ko.observable(undefined);
        self.versions = ko.observableArray([]);
        self.version = ko.observable(undefined);
        self.firmware_path = ko.observable(undefined);

        self.firmware_info = undefined;

        self.custom_selected = ko.computed(() => {
            return self.version() === "custom";
        });

        self.flash_firmware = function() {
    const fileInput = document.getElementById("fileInput");  // Update this with the actual ID of your file input element

    // Check if a file is selected
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];

        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append("file", file);

        // Make a POST request to the server to handle the file upload
        $.ajax({
            type: "POST",
            url: "/plugin/flashsailfish/firmware_file",
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log("File upload successful:", response);
                // Add any further actions after a successful upload
            },
            error: function(error) {
                console.error("File upload failed:", error);
                // Handle the error, if necessary
            }
        });
    } else {
        console.warn("No file selected for upload");
    }
};


        self.refresh_firmware_xml = function() {
    $.getJSON("/plugin/flashsailfish/firmware_info", function(data) {
        self.firmware_info = data;
        self.refresh_observables();
    });
};

        self.refresh_observables = function() {
    self.boards.removeAll();  // Clear the array first
            if (self.firmware_info !== undefined) {
        console.log("Firmware Info:", self.firmware_info);  // Add this line for debugging
                for (const board in self.firmware_info) {
            if (self.firmware_info.hasOwnProperty(board)) {
                console.log("Adding board:", board);  // Add this line for debugging
                self.boards.push(board);
            }
        }

        console.log("Sorted Boards:", self.boards());  // Add this line for debugging

        self.boards.sort();
    }
        };

        self.fetch_firmware_info = function() {
            $.getJSON("/plugin/flashsailfish/firmware_info", function(data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        self.onSettingsShown = self.fetch_firmware_info;
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        [ "settingsViewModel" ],
        [ "#settings_plugin_flashsailfish" ]
    ]);
});
