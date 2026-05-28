# Compiler
CXX = g++

# Flags
CXXFLAGS = -Wall -Wextra -std=c++17

# Target executable name
TARGET = app

# Directories
SRC_DIR = .
BUILD_DIR = ../build

# Source and object files
SRCS = $(SRC_DIR)/main.cpp
OBJS = $(SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)

# Final binary path
BIN = $(BUILD_DIR)/$(TARGET)

# Default target
all: $(BIN)

# Link step
$(BIN): $(OBJS)
	@mkdir -p $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) -o $@ $^

# Compile step (objects go into ../build)
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cpp
	@mkdir -p $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Clean
clean:
	rm -rf $(BUILD_DIR)