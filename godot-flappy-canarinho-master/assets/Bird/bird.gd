extends CharacterBody2D

# This signal is emitted when the bird collides with something.
signal hit

# The upward force applied when the player "flaps".
const FLAP_FORCE = -425.0

# Get the project's gravity setting so we can apply it.
var gravity = 980 * 1.4

# We need a reference to the AnimatedSprite2D node.
@onready var animated_sprite = $AnimatedSprite2D


func _ready():
	# Start with the "fall" animation when the game begins.
	animated_sprite.play("fall")


func _physics_process(delta):
	# Apply gravity every frame.
	if position.y > 720:
		hit.emit()
	else:
		velocity.y += gravity * delta

		# Apply the bird's velocity. move_and_slide handles collisions.
		move_and_slide()

		# If a collision occurs, emit the "hit" signal.
		# The get_slide_collision_count() > 0 check is a reliable way to detect this.
		if get_slide_collision_count() > 0:
			hit.emit()


func _unhandled_input(event):
	# Check for the flap input.
	if event.is_action_pressed("flap"):
		velocity.y = FLAP_FORCE
		# Play the "flap" animation once.
		animated_sprite.play("flap")
		# Create a one-shot timer that will call a function after 0.25 seconds.
		# This is connected using a lambda function for a concise solution.
		get_tree().create_timer(0.25).timeout.connect(func(): animated_sprite.play("fall"))


# This function disables the bird's physics process.
func stop():
	set_physics_process(false)
