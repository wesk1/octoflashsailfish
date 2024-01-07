/*
 * View model for OctoPrint-FlashSailfish
 *
 * Author: Mark Walker
 * License: GPLv3
 */
$(function () {
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

        self.flash_firmware = function () {
            const fileInput = document.getElementById("fileInput"); // Update this with the actual ID of your file input element

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
                    success: function (response) {
                        console.log("File upload successful:", response);
                        // Add any further actions after a successful upload
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        console.error("File upload failed:", textStatus, errorThrown);
                        // Handle the error, if necessary
                    },
                });
            } else {
                console.warn("No file selected for upload");
            }
        };

        self.refresh_firmware_xml = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info")
                .done(function (data) {
                    self.firmware_info = data;
                    self.refresh_observables();
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    console.error("Error fetching firmware info:", textStatus, errorThrown);
                    // Handle the error, if necessary
                });
        };

        self.refresh_observables = function () {
            self.boards.removeAll(); // Clear the array first
            self.versions.removeAll(); // Clear the versions array
            if (self.firmware_info !== undefined) {
                console.log("Firmware Info:", self.firmware_info); // Add this line for debugging
                for (const board in self.firmware_info) {
                    if (self.firmware_info.hasOwnProperty(board)) {
                        console.log("Adding board:", board); // Add this line for debugging
                        self.boards.push(board);
                    }
                }

                console.log("Sorted Boards:", self.boards()); // Add this line for debugging

                self.boards.sort();
            }
        };

        self.board.subscribe(function (newBoard) {
            self.versions.removeAll(); // Clear the versions array first
            if (newBoard !== undefined && self.firmware_info !== undefined) {
                const firmwareVersions = self.firmware_info[newBoard];

                if (firmwareVersions !== undefined) {
                    for (const version in firmwareVersions) {
                        if (firmwareVersions.hasOwnProperty(version)) {
                            self.versions.push(version);
                        }
                    }

                    console.log("Sorted Versions:", self.versions()); // Add this line for debugging

                    self.versions.sort();
                }
            }
        });

        self.fetch_firmware_info = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info")
                .done(function (data) {
                    self.firmware_info = data;
                    self.refresh_observables();
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    console.error("Error fetching firmware info:", textStatus, errorThrown);
                    // Handle the error, if necessary
                });
        };

        self.onSettingsShown = self.fetch_firmware_info;
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel"],
        ["#settings_plugin_flashsailfish"],
    ]);
});
