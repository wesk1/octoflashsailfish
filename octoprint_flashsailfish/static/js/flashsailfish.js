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

        // Observable to store the uploaded filename
        self.uploadedFilename = ko.observable("");

        // Observable for displaying the selected filename
        self.selectedFileName = ko.observable("");

        // Function to update the label with the selected filename
        self.updateSelectedFileName = function () {
            const fileInput = document.getElementById("fileInput");

            // Ensure that the event handler is triggered when the file selection changes
            $(fileInput).on("change", function () {
                // Update the label with the selected filename
                self.selectedFileName(this.files.length > 0 ? this.files[0].name : "");
            });
        };

        // Separate function to handle file upload
        self.uploadFirmware = function (url, successCallback, errorCallback) {
            const fileInput = document.getElementById("fileInput");

            // Check if a file is selected
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];

                // Create a FormData object to send the file
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
        self.flash_firmware = function () {
            // Use the uploadFirmware function to handle the file upload
            self.uploadFirmware("/plugin/flashsailfish/firmwares/*.hex", function (response) {
                console.log("File upload successful:", response);

                // Check if the response contains the uploaded filename
                if (response && response.filename) {
                    // Update the view model with the uploaded filename
                    self.uploadedFilename(response.filename);
                }

                // Add any further actions after a successful upload
                // (For example, initiate the firmware flashing process here)
            }, function (error) {
                console.error("File upload failed:", error);
                // Handle the error, if necessary
            });
        };

        self.refresh_firmware_xml = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        self.refresh_observables = function () {
            self.boards.removeAll();  // Clear the array first
            self.versions.removeAll();  // Clear the versions array
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

        self.board.subscribe(function (newBoard) {
            self.versions.removeAll();  // Clear the versions array first
            if (newBoard !== undefined && self.firmware_info !== undefined) {
                const firmwareVersions = self.firmware_info[newBoard]?.firmwares;  // Fix: Access the 'firmwares' property using optional chaining

                if (firmwareVersions !== undefined) {
                    for (const version in firmwareVersions) {
                        if (firmwareVersions.hasOwnProperty(version)) {
                            self.versions.push(version);
                        }
                    }

                    console.log("Sorted Versions:", self.versions());  // Add this line for debugging

                    self.versions.sort();
                }
            }
        });

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

        self.fetch_firmware_info = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        self.onSettingsShown = self.fetch_firmware_info;

        // Call the function to set up the file input change event
        self.updateSelectedFileName();
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel"],
        ["#settings_plugin_flashsailfish"]
    ]);
});
