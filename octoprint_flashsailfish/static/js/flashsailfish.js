$(function () {
    function FlashsailfishViewModel(parameters) {
        const self = this;

        self.settings = parameters[0];
        self.boards = ko.observableArray([]);
        self.board = ko.observable();
        self.versions = ko.observableArray([]);
        self.version = ko.observable();
        self.firmware_path = ko.observable();
        self.selectedFirmwareDescription = ko.observable("");
        self.firmware_info = undefined;
        self.uploadedFilename = ko.observable("");
        self.selectedFileName = ko.observable("");

        // Function to update the label with the selected filename
        self.updateSelectedFileName = function () {
            // Event listener for file input change
            $("#fileInput").on("change", function () {
                // Update the label with the selected filename
                self.selectedFileName(this.files.length > 0 ? this.files[0].name : "");
            });
        };
        // Call the function to set up the file input change event
        self.updateSelectedFileName();

        // Separate function to handle file upload
        self.uploadFirmware_click = function (url, successCallback, errorCallback) {
            const fileInput = document.getElementById("fileInput");

            // Check if a file is selected
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];

                // Create a FormData object to send the file is
                const formData = new FormData();
                formData.append("file", file);

                // Make a POST request to the server to handle the file upload
                $.ajax({
                    type: "POST",
                    url: url,
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: successCallback,
                    error: errorCallback
                });
            } else {
                console.warn("No file selected for upload");
            }
        };

        // Modify flash_firmware to initiate the firmware flashing process
        //self.flash_firmware = function () {
        // Use the uploadFirmware function to handle the file upload
        // self.uploadFirmware("/plugin/flashsailfish/firmwares/*.hex", function (response) {
        //  console.log("File upload successful:", response);

        // Check if the response contains the uploaded filename
        //  if (response && response.filename) {
        // Update the view model with the uploaded filename
        // self.uploadedFilename(response.filename);
        //  }

        // Add any further actions after a successful upload
        // (For example, initiate the firmware flashing process here)
        //  }, function (error) {
        //     console.error("File upload failed:", error);
        // Handle the error, if necessary
        // });
        // };

        // Function to refresh firmware information
        self.refresh_button_click = function () {
            $("#downloadMessageLabel").text("");
            $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        // Function to refresh observable arrays
        self.refresh_observables = function () {
            self.boards.removeAll();
            self.versions.removeAll();

            if (self.firmware_info !== undefined) {
                console.log("Firmware Info:", self.firmware_info);
                for (const board in self.firmware_info) {
                    if (self.firmware_info.hasOwnProperty(board)) {
                        console.log("Adding board:", board);
                        self.boards.push(board);
                    }
                }

                console.log("Sorted Boards:", self.boards());
                self.boards.sort();
            }
        };

        // Firmware version dropdown gets updated when the board changes
        self.board.subscribe(function (newBoard) {
            self.versions.removeAll();
            if (newBoard !== undefined && self.firmware_info !== undefined) {
                const firmwareVersions = self.firmware_info[newBoard]?.firmwares;

                if (firmwareVersions !== undefined) {
                    for (const version in firmwareVersions) {
                        if (firmwareVersions.hasOwnProperty(version)) {
                            self.versions.push(version);
                        }
                    }

                    console.log("Sorted Versions:", self.versions());
                    self.versions.sort();
                }
            }
        });

        // Firmware Description gets updated
        self.version.subscribe(function (newVersion) {
            if (newVersion !== undefined && self.firmware_info !== undefined) {
                const selectedBoard = self.board();
                const firmwareInfo = self.firmware_info[selectedBoard];

                if (firmwareInfo !== undefined) {
                    const firmwareVersions = firmwareInfo.firmwares;

                    if (firmwareVersions !== undefined) {
                        const selectedFirmware = firmwareVersions[newVersion];

                        if (selectedFirmware !== undefined && selectedFirmware.description !== undefined) {
                            self.selectedFirmwareDescription(selectedFirmware.description);
                        } else {
                            self.selectedFirmwareDescription("");
                        }
                    }
                }
            }
        });

        // download firmware function
               self.download_firmware = function () {
            // Get the selected board and version
            const selectedBoard = self.board();
            const selectedVersion = self.version();
            const xmlUrl = self.settings.settings.plugins.flashsailfish.url();

            // Check if a board and version are selected
            if (selectedBoard && selectedVersion) {
                // Make a GET request to retrieve the firmware information
                $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                    // Get the firmware information for the selected board and version
                    const firmwareInfo = data[selectedBoard];
                    const selectedFirmware = firmwareInfo.firmwares[selectedVersion];
                    const firmwareUrl = xmlUrl.replace(/\/firmware\.xml$/, '/');

                    // Check if the firmware information is available
                    if (selectedFirmware) {
                        // Get the relative path for the firmware
                        const relpath = selectedFirmware.relpath;
                        console.log("Constructed Firmware URL:", firmwareUrl + relpath);

                        // Make a POST request to initiate the firmware download
                        $.ajax({
                            type: "GET",
                            proxyurl: "/plugin/flashsailfish/download_firmware",
                            data: {
                                url: firmwareUrl + self.firmware_info[selectedBoard].firmwares[selectedVersion].relpath,
                                destination_dir: "/opt/OctoPrint/flashsailfish/firmwares/"
                            },
                            success: function() {
							// Set the content of the download message label
							$("#downloadMessageLabel").text("Firmware download completed successfully!");
							},
							error: function(xhr, status, error) {
							// Handle error if needed
							console.error("Firmware download failed:", error);
							$("#downloadMessageLabel").text("Firmware download failed!");
                            }
                        });
                    } else {
                        console.warn("Selected firmware information not available");
                    }
                });
            } else {
                console.warn("No board or version selected");
            }
        };
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel"],
        ["#settings_plugin_flashsailfish"]
    ]);
});
