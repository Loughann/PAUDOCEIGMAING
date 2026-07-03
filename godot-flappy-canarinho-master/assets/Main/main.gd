extends Node

# --- Scenes ---
@export var pipe_scene: PackedScene

# --- Nodes ---
@onready var bird = $Bird
@onready var pipe_spawner = $PipeSpawner
@onready var parallax_background = $ParallaxBackground
@onready var score_label = $UI/ScoreLabel
@onready var message_label = $UI/MessageLabel

# --- Game Variables ---
var scroll_speed = 150.0
var score = 0
var start_button: Button

# A simple state machine to manage the game's flow.
enum GameState { READY, PLAYING, GAME_OVER }
var current_state

func _ready():
	# Set up touch inputs and mouse clicks to map to 'flap'
	_setup_mobile_inputs()
	
	# Create start button programmatically
	_create_start_button()
	
	# When the game starts, set the state to READY.
	set_state(GameState.READY)

func _process(delta):
	# The parallax background is moved by updating its scroll_offset.
	# This is only done when the game is actively playing.
	if current_state == GameState.PLAYING:
		parallax_background.scroll_offset.x -= scroll_speed * delta

func _unhandled_input(event):
	# This function handles player input based on the current game state.
	if event.is_action_pressed("flap"):
		if current_state == GameState.GAME_OVER:
			# Reload the entire scene to restart the game.
			get_tree().reload_current_scene()

func _setup_mobile_inputs():
	# Configure inputs programmatically for Mobile touch/Mouse click emulation
	if not InputMap.has_action("flap"):
		InputMap.add_action("flap")
	
	# Check if mouse click is already there
	var is_mouse_added = false
	for event in InputMap.action_get_events("flap"):
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			is_mouse_added = true
	
	if not is_mouse_added:
		var ev_mouse = InputEventMouseButton.new()
		ev_mouse.button_index = MOUSE_BUTTON_LEFT
		ev_mouse.pressed = true
		InputMap.action_add_event("flap", ev_mouse)

func _create_start_button():
	start_button = Button.new()
	start_button.text = "Iniciar Jogo"
	start_button.name = "StartButton"
	
	# Styling
	start_button.custom_minimum_size = Vector2(240, 70)
	
	# Center position (Viewport size is 540x720)
	# 540/2 - 240/2 = 150. Y = 480 (below message_label)
	start_button.position = Vector2(150, 480)
	
	# Font size override
	start_button.add_theme_font_size_override("font_size", 32)
	
	# Connect signal
	start_button.pressed.connect(_on_start_button_pressed)
	
	# Add to UI layer
	$UI.add_child(start_button)

func _on_start_button_pressed():
	if current_state == GameState.READY:
		set_state(GameState.PLAYING)

func set_state(new_state):
	current_state = new_state
	match current_state:
		GameState.READY:
			# Prepare for a new game.
			message_label.text = "Bate as asas\npara começar"
			message_label.show()
			if start_button:
				start_button.show()
			score = 0
			score_label.text = "R$ " + str(score) + ",00"
			bird.position = Vector2(120, 360)
			bird.set_physics_process(false) # Keep bird from falling
			bird.set_process_unhandled_input(false) # Stop bird from flapping
			if not bird.hit.is_connected(_game_over):
				bird.hit.connect(_game_over)
			
		GameState.PLAYING:
			# Start the game.
			message_label.hide()
			if start_button:
				start_button.hide()
			pipe_spawner.start()
			bird.set_physics_process(true) # Bird can now move
			bird.set_process_unhandled_input(true) # Bird can now flap
			
		GameState.GAME_OVER:
			# End the game.
			pipe_spawner.stop()
			bird.stop()
			bird.set_process_unhandled_input(false) # Stop bird from flapping
			message_label.text = "Game Over\nToque para tentar de novo"
			message_label.show()
			

func _on_pipe_spawner_timeout():
	# This function is called every time the PipeSpawner timer finishes.
	var pipe = pipe_scene.instantiate()
	
	# Set a random vertical position for the new pipe.
	pipe.position = Vector2(600, randi_range(250, 600))
	pipe.scroll_speed = scroll_speed
	
	# Connect to the pipe's custom signals.
	pipe.hit.connect(_game_over)
	pipe.scored.connect(_on_pipe_scored)
	
	add_child(pipe)

func _game_over():
	# If a pipe's "hit" signal is received, end the game.
	set_state(GameState.GAME_OVER)
	get_tree().call_group("pipes", "stop_moving")

func _on_pipe_scored():
	# If a pipe's "scored" signal is received, update the score.
	score += 1
	score_label.text = "R$ " + str(score) + ",00"

	# Difficulty Scaling: Every 5 points, increase the speed.
	if score % 5 == 0:
		scroll_speed += 10.0

func _on_bird_hit():
	# This is connected to the bird's "hit" signal.
	# If the bird hits anything (like the ground), end the game.
	set_state(GameState.GAME_OVER)

